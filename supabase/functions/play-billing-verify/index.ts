import { createClient } from "npm:@supabase/supabase-js@2";

const PACKAGE_NAME = "com.cavazani.gestao";
const PRODUCTS: Record<string, string> = {
  plano_profissional: "professional",
  plano_pro_nuvem: "pro_cloud",
};
const ACCESS_STATES = new Set([
  "SUBSCRIPTION_STATE_ACTIVE",
  "SUBSCRIPTION_STATE_IN_GRACE_PERIOD",
  "SUBSCRIPTION_STATE_CANCELED",
]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization, apikey, content-type",
      "access-control-allow-methods": "POST, OPTIONS",
    },
  });
}

function b64url(bytes: Uint8Array) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function utf8b64url(value: string) {
  return b64url(new TextEncoder().encode(value));
}

function pemToBytes(pem: string) {
  const raw = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(raw);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function sha256Hex(value: string) {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
  return Array.from(digest).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function googleAccessToken(serviceAccount: { client_email: string; private_key: string }) {
  const now = Math.floor(Date.now() / 1000);
  const header = utf8b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = utf8b64url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToBytes(serviceAccount.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      key,
      new TextEncoder().encode(unsigned),
    ),
  );
  const assertion = `${unsigned}.${b64url(signature)}`;

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const tokenBody = await tokenResponse.json();
  if (!tokenResponse.ok || !tokenBody.access_token) {
    throw new Error(`google_oauth_failed:${tokenResponse.status}`);
  }
  return String(tokenBody.access_token);
}

async function verifyWithGoogle(accessToken: string, purchaseToken: string) {
  const url =
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(PACKAGE_NAME)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;
  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: "application/json",
    },
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`google_purchase_verify_failed:${response.status}`);
  }
  return body;
}

async function acknowledgeIfNeeded(
  accessToken: string,
  purchaseToken: string,
  productId: string,
  acknowledgementState: string,
) {
  if (acknowledgementState !== "ACKNOWLEDGEMENT_STATE_PENDING") return;
  const url =
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(PACKAGE_NAME)}/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: "{}",
  });
  if (!response.ok) {
    throw new Error(`google_acknowledge_failed:${response.status}`);
  }
}

function getSecretKey() {
  const modern = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (modern) {
    try {
      const parsed = JSON.parse(modern);
      if (parsed.default) return String(parsed.default);
    } catch (_) {}
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

async function optionalUserId(authHeader: string | null, admin: ReturnType<typeof createClient>) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const jwt = authHeader.slice(7).trim();
  if (!jwt || jwt.startsWith("sb_")) return null;
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data.user) return null;
  return data.user.id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const requestBody = await req.json().catch(() => ({}));
    const purchaseToken = String(requestBody.purchaseToken ?? "").trim();
    if (!purchaseToken || purchaseToken.length < 20) {
      return json({ error: "purchase_token_required" }, 400);
    }

    const rawServiceAccount = Deno.env.get("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON");
    if (!rawServiceAccount) {
      return json({ error: "billing_backend_not_configured" }, 503);
    }
    let serviceAccount: { client_email: string; private_key: string };
    try {
      serviceAccount = JSON.parse(rawServiceAccount);
    } catch (_) {
      return json({ error: "billing_service_account_invalid" }, 503);
    }
    if (!serviceAccount.client_email || !serviceAccount.private_key) {
      return json({ error: "billing_service_account_incomplete" }, 503);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const secretKey = getSecretKey();
    if (!supabaseUrl || !secretKey) {
      return json({ error: "supabase_backend_not_configured" }, 503);
    }
    const admin = createClient(supabaseUrl, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const googleToken = await googleAccessToken(serviceAccount);
    const purchase = await verifyWithGoogle(googleToken, purchaseToken);
    const state = String(purchase.subscriptionState ?? "SUBSCRIPTION_STATE_UNSPECIFIED");
    const lineItems = Array.isArray(purchase.lineItems) ? purchase.lineItems : [];
    const recognized = lineItems.filter((item: any) => PRODUCTS[String(item.productId ?? "")]);
    if (!recognized.length) {
      return json({ error: "subscription_product_not_recognized" }, 400);
    }

    recognized.sort((a: any, b: any) => {
      const ra = PRODUCTS[String(a.productId)] === "pro_cloud" ? 2 : 1;
      const rb = PRODUCTS[String(b.productId)] === "pro_cloud" ? 2 : 1;
      return rb - ra;
    });
    const item = recognized[0];
    const productId = String(item.productId);
    const tier = PRODUCTS[productId];
    const basePlanId = item.offerDetails?.basePlanId
      ? String(item.offerDetails.basePlanId)
      : null;
    const expiryDates = recognized
      .map((x: any) => x.expiryTime ? new Date(x.expiryTime) : null)
      .filter((x: Date | null): x is Date => !!x && !Number.isNaN(x.getTime()));
    const expiresAt = expiryDates.length
      ? new Date(Math.max(...expiryDates.map((x) => x.getTime()))).toISOString()
      : null;
    const notExpired = !expiresAt || new Date(expiresAt).getTime() > Date.now();
    const hasAccess = ACCESS_STATES.has(state) && notExpired;

    if (hasAccess) {
      await acknowledgeIfNeeded(
        googleToken,
        purchaseToken,
        productId,
        String(purchase.acknowledgementState ?? ""),
      );
    }

    const purchaseTokenHash = await sha256Hex(purchaseToken);
    const userId = await optionalUserId(req.headers.get("authorization"), admin);

    const { data: existingEntitlement, error: existingError } = await admin
      .from("playstore_entitlements")
      .select("user_id")
      .eq("purchase_token_hash", purchaseTokenHash)
      .maybeSingle();
    if (existingError) throw new Error(`entitlement_lookup_failed:${existingError.message}`);
    if (
      userId &&
      existingEntitlement?.user_id &&
      existingEntitlement.user_id !== userId
    ) {
      return json({ error: "purchase_already_linked" }, 409);
    }

    const row: Record<string, unknown> = {
      purchase_token_hash: purchaseTokenHash,
      package_name: PACKAGE_NAME,
      product_id: productId,
      base_plan_id: basePlanId,
      tier,
      subscription_state: state,
      expires_at: expiresAt,
      auto_renew: !!item.autoRenewingPlan?.autoRenewEnabled,
      order_id: item.latestSuccessfulOrderId ?? purchase.latestOrderId ?? null,
      last_verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (userId) row.user_id = userId;

    const { error: upsertError } = await admin
      .from("playstore_entitlements")
      .upsert(row, { onConflict: "purchase_token_hash" });
    if (upsertError) throw new Error(`entitlement_upsert_failed:${upsertError.message}`);

    return json({
      ok: true,
      tier: hasAccess ? tier : "free",
      entitled: hasAccess,
      pending: state === "SUBSCRIPTION_STATE_PENDING",
      subscriptionState: state,
      productId,
      basePlanId,
      expiresAt,
      autoRenew: !!item.autoRenewingPlan?.autoRenewEnabled,
      linkedToUser: !!userId,
      verifiedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("play-billing-verify", error);
    const message = error instanceof Error ? error.message : "unknown_error";
    if (message.startsWith("google_purchase_verify_failed:404")) {
      return json({ error: "purchase_not_found" }, 404);
    }
    return json({ error: "billing_verification_failed", detail: message }, 502);
  }
});
