import { createClient } from "npm:@supabase/supabase-js@2";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@6";

const PACKAGE_NAME = "com.vezora.app";
const PRODUCTS: Record<string, string> = {
  plano_profissional: "professional",
  plano_pro_nuvem: "pro_cloud",
};
const JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
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
  const raw = pem.replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "").replace(/\s+/g, "");
  const bin = atob(raw);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
async function sha256Hex(value: string) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return Array.from(digest).map((b) => b.toString(16).padStart(2, "0")).join("");
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
    "pkcs8", pemToBytes(serviceAccount.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned),
  ));
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
  if (!tokenResponse.ok || !tokenBody.access_token) throw new Error("google_oauth_failed");
  return String(tokenBody.access_token);
}
async function verifyPurchase(accessToken: string, purchaseToken: string) {
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(PACKAGE_NAME)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;
  const r = await fetch(url, { headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" } });
  const body = await r.json();
  if (!r.ok) throw new Error(`google_verify_${r.status}`);
  return body;
}
async function verifyPushIdentity(req: Request) {
  const audience = Deno.env.get("GOOGLE_PLAY_RTDN_AUDIENCE");
  if (!audience) throw new Error("rtdn_audience_not_configured");
  const header = req.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) throw new Error("missing_oidc");
  const token = header.slice(7);
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience,
  });
  const expectedEmail = Deno.env.get("GOOGLE_PLAY_RTDN_PUSH_EMAIL");
  if (expectedEmail && payload.email !== expectedEmail) throw new Error("unexpected_push_identity");
  return payload;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return response({ error: "method_not_allowed" }, 405);
  try {
    await verifyPushIdentity(req);

    const rawServiceAccount = Deno.env.get("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON");
    if (!rawServiceAccount) return response({ error: "billing_backend_not_configured" }, 503);
    const serviceAccount = JSON.parse(rawServiceAccount);
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const secretKey = getSecretKey();
    if (!supabaseUrl || !secretKey) return response({ error: "supabase_backend_not_configured" }, 503);
    const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const envelope = await req.json();
    const encoded = envelope?.message?.data;
    if (!encoded) return response({ error: "missing_pubsub_data" }, 400);
    const notification = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(encoded), c => c.charCodeAt(0))));

    if (notification.packageName !== PACKAGE_NAME) return response({ error: "wrong_package" }, 400);
    if (notification.testNotification) return response({ ok: true, test: true });

    const sub = notification.subscriptionNotification;
    if (!sub?.purchaseToken) return response({ ok: true, ignored: true });

    const googleToken = await googleAccessToken(serviceAccount);
    const purchase = await verifyPurchase(googleToken, String(sub.purchaseToken));
    const lineItems = Array.isArray(purchase.lineItems) ? purchase.lineItems : [];
    const recognized = lineItems.filter((x: any) => PRODUCTS[String(x.productId ?? "")]);
    if (!recognized.length) return response({ ok: true, ignored: true });

    recognized.sort((a: any, b: any) =>
      (PRODUCTS[String(b.productId)] === "pro_cloud" ? 2 : 1) -
      (PRODUCTS[String(a.productId)] === "pro_cloud" ? 2 : 1)
    );
    const item = recognized[0];
    const productId = String(item.productId);
    const tier = PRODUCTS[productId];
    const state = String(purchase.subscriptionState ?? "SUBSCRIPTION_STATE_UNSPECIFIED");
    const expiryDates = recognized
      .map((x: any) => x.expiryTime ? new Date(x.expiryTime) : null)
      .filter((x: Date | null): x is Date => !!x && !Number.isNaN(x.getTime()));
    const expiresAt = expiryDates.length
      ? new Date(Math.max(...expiryDates.map((x) => x.getTime()))).toISOString()
      : null;

    const tokenHash = await sha256Hex(String(sub.purchaseToken));
    let userId: string | null = null;
    const { data: existing } = await admin.from("playstore_entitlements")
      .select("user_id").eq("purchase_token_hash", tokenHash).maybeSingle();
    userId = existing?.user_id ?? null;

    if (!userId && purchase.linkedPurchaseToken) {
      const linkedHash = await sha256Hex(String(purchase.linkedPurchaseToken));
      const { data: linked } = await admin.from("playstore_entitlements")
        .select("user_id").eq("purchase_token_hash", linkedHash).maybeSingle();
      userId = linked?.user_id ?? null;
    }

    const row: Record<string, unknown> = {
      purchase_token_hash: tokenHash,
      package_name: PACKAGE_NAME,
      product_id: productId,
      base_plan_id: item.offerDetails?.basePlanId ?? null,
      tier,
      subscription_state: state,
      expires_at: expiresAt,
      auto_renew: !!item.autoRenewingPlan?.autoRenewEnabled,
      order_id: item.latestSuccessfulOrderId ?? purchase.latestOrderId ?? null,
      last_verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (userId) row.user_id = userId;

    const { error } = await admin.from("playstore_entitlements")
      .upsert(row, { onConflict: "purchase_token_hash" });
    if (error) throw error;

    return response({ ok: true, tier, state, expiresAt, linkedToUser: !!userId });
  } catch (error) {
    console.error("google-play-rtdn", error);
    const message = error instanceof Error ? error.message : "unknown_error";
    if (message.includes("oidc") || message.includes("push_identity") || message.includes("JWT") || message.includes("signature")) {
      return response({ error: "unauthorized_push" }, 401);
    }
    return response({ error: "rtdn_failed", detail: message }, 500);
  }
});