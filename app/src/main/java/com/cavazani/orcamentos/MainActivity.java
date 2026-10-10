package com.cavazani.orcamentos;

import android.Manifest;
import android.app.Activity;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import com.android.billingclient.api.*;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Date;
import java.util.Locale;
import java.text.SimpleDateFormat;


import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

public class MainActivity extends Activity {
    private WebView webView;
    private BillingClient billingClient;
    private boolean billingReady = false;

    private final Map<String, ProductDetails> productDetailsMap = new HashMap<>();
    private List<Purchase> ownedPurchases = new ArrayList<>();
    private String productCatalogJson = "{\"ready\":false,\"products\":[]}";

    private static final int STORAGE_PERMISSION_CODE = 71;
    private static final int BACKUP_CREATE_CODE = 81;
    private static final int BACKUP_OPEN_CODE = 82;
    private String pendingBackupJson = null;

    private static final String SECURE_PREFS = "marcenaria_pro_secure_state";
    private static final String AUTH_PREF_KEY = "supabase_auth_session";
    private static final String BILLING_TOKEN_PREF_KEY = "billing_purchase_token";
    private static final String SECURE_KEY_ALIAS = "marcenaria_pro_secure_key";

    private static final String PLAN_PREFS = "marcenaria_pro_plan";
    private static final String PLAN_KEY = "tier";
    private static final String PLAN_TIME_KEY = "verified_at";
    private static final String PLAN_EXPIRY_KEY = "expires_at";
    private static final String PLAN_STATE_KEY = "subscription_state";
    private static final String PLAN_PRODUCT_KEY = "product_id";
    private static final String PLAN_BASE_KEY = "base_plan_id";
    private static final String PLAN_AUTORENEW_KEY = "auto_renew";

    private static final String PRODUCT_PROFESSIONAL = "plano_profissional";
    private static final String PRODUCT_CLOUD = "plano_pro_nuvem";
    private static final String BASE_MONTHLY = "mensal";
    private static final String BASE_YEARLY = "anual";

    private static final String BILLING_VERIFY_URL =
            "https://vssbgmzkprhsbpxdtald.supabase.co/functions/v1/play-billing-verify";
    private static final String SUPABASE_PUBLISHABLE_KEY =
            "sb_publishable_ljcrxLGYHRkDCX9vH9_Byg_oYfU7Qo6";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(6, 26, 39));
        getWindow().setNavigationBarColor(Color.rgb(6, 26, 39));

        webView = new WebView(this);
        setContentView(webView);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setLoadsImagesAutomatically(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);

        webView.addJavascriptInterface(new AndroidBridge(this), "AndroidApp");
        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient());
        webView.loadUrl("file:///android_asset/index.html");

        initBilling();
    }

    private void initBilling() {
        PendingPurchasesParams pendingParams = PendingPurchasesParams.newBuilder()
                .enableOneTimeProducts()
                .build();

        billingClient = BillingClient.newBuilder(this)
                .setListener(this::onPurchasesUpdated)
                .enablePendingPurchases(pendingParams)
                .enableAutoServiceReconnection()
                .build();

        billingClient.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(BillingResult billingResult) {
                billingReady = billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK;
                if (billingReady) {
                    queryProductCatalog();
                    queryOwnedSubscriptions(false);
                } else {
                    notifyPlanChanged();
                    notifyCatalogChanged();
                }
            }

            @Override
            public void onBillingServiceDisconnected() {
                billingReady = false;
                notifyPlanChanged();
                notifyCatalogChanged();
            }
        });
    }

    private void onPurchasesUpdated(BillingResult billingResult, List<Purchase> purchases) {
        if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK && purchases != null) {
            boolean hasPending = false;
            for (Purchase purchase : purchases) {
                if (purchase.getPurchaseState() == Purchase.PurchaseState.PENDING) {
                    hasPending = true;
                    break;
                }
            }
            if (hasPending) showToast("Pagamento pendente. O plano será liberado após a confirmação da Google Play.");
            verifyPurchasesWithServer(purchases, true);
        } else if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.USER_CANCELED) {
            showToast("Não foi possível concluir a compra: " + billingResult.getDebugMessage());
        }
    }

    private void queryProductCatalog() {
        if (billingClient == null || !billingReady) {
            notifyCatalogChanged();
            return;
        }

        List<QueryProductDetailsParams.Product> products = new ArrayList<>();
        products.add(QueryProductDetailsParams.Product.newBuilder()
                .setProductId(PRODUCT_PROFESSIONAL)
                .setProductType(BillingClient.ProductType.SUBS)
                .build());
        products.add(QueryProductDetailsParams.Product.newBuilder()
                .setProductId(PRODUCT_CLOUD)
                .setProductType(BillingClient.ProductType.SUBS)
                .build());

        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                .setProductList(products)
                .build();

        billingClient.queryProductDetailsAsync(params, (billingResult, result) -> {
            productDetailsMap.clear();
            JSONArray productArray = new JSONArray();

            if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                for (ProductDetails details : result.getProductDetailsList()) {
                    productDetailsMap.put(details.getProductId(), details);
                    try {
                        JSONObject p = new JSONObject();
                        p.put("productId", details.getProductId());
                        p.put("tier", tierForProduct(details.getProductId()));
                        p.put("title", details.getTitle());
                        p.put("description", details.getDescription());

                        JSONArray offersJson = new JSONArray();
                        List<ProductDetails.SubscriptionOfferDetails> offers = details.getSubscriptionOfferDetails();
                        if (offers != null) {
                            for (ProductDetails.SubscriptionOfferDetails offer : offers) {
                                JSONObject o = new JSONObject();
                                o.put("basePlanId", offer.getBasePlanId());
                                o.put("offerId", offer.getOfferId());
                                o.put("offerToken", offer.getOfferToken());

                                List<ProductDetails.PricingPhase> phases =
                                        offer.getPricingPhases().getPricingPhaseList();
                                if (phases != null && !phases.isEmpty()) {
                                    ProductDetails.PricingPhase recurring = phases.get(phases.size() - 1);
                                    o.put("formattedPrice", recurring.getFormattedPrice());
                                    o.put("billingPeriod", recurring.getBillingPeriod());
                                    o.put("priceCurrencyCode", recurring.getPriceCurrencyCode());
                                    o.put("priceAmountMicros", recurring.getPriceAmountMicros());
                                }
                                offersJson.put(o);
                            }
                        }
                        p.put("offers", offersJson);
                        productArray.put(p);
                    } catch (Exception ignored) {}
                }
            }

            try {
                JSONObject root = new JSONObject();
                root.put("ready", billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK);
                root.put("products", productArray);
                root.put("responseCode", billingResult.getResponseCode());
                productCatalogJson = root.toString();
            } catch (Exception ignored) {
                productCatalogJson = "{\"ready\":false,\"products\":[]}";
            }
            notifyCatalogChanged();
        });
    }

    private void queryOwnedSubscriptions(boolean userRequested) {
        if (billingClient == null || !billingReady) {
            if (userRequested) showToast("A Google Play ainda não está disponível.");
            notifyPlanChanged();
            return;
        }

        QueryPurchasesParams params = QueryPurchasesParams.newBuilder()
                .setProductType(BillingClient.ProductType.SUBS)
                .build();

        billingClient.queryPurchasesAsync(params, (billingResult, purchases) -> {
            if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                ownedPurchases = purchases == null ? new ArrayList<>() : new ArrayList<>(purchases);
                if (ownedPurchases.isEmpty()) {
                    clearVerifiedPlan();
                    if (userRequested) showToast("Nenhuma assinatura ativa foi encontrada nesta conta Google.");
                } else {
                    verifyPurchasesWithServer(ownedPurchases, false);
                }
            } else {
                if (userRequested) showToast("Não foi possível restaurar as compras: " + billingResult.getDebugMessage());
                notifyPlanChanged();
            }
        });
    }

    private void verifyPurchasesWithServer(List<Purchase> purchases, boolean fromPurchaseFlow) {
        final List<Purchase> copy = purchases == null ? Collections.emptyList() : new ArrayList<>(purchases);

        new Thread(() -> {
            JSONObject best = null;
            String bestToken = null;
            int bestRank = 0;
            boolean serverReached = false;
            boolean pendingFound = false;

            for (Purchase purchase : copy) {
                if (purchase.getPurchaseState() == Purchase.PurchaseState.PENDING) {
                    pendingFound = true;
                    continue;
                }
                if (purchase.getPurchaseState() != Purchase.PurchaseState.PURCHASED) continue;

                try {
                    JSONObject verified = verifyPurchaseOnServer(purchase.getPurchaseToken());
                    serverReached = true;
                    if (!verified.optBoolean("entitled", false)) continue;

                    String tier = verified.optString("tier", "free");
                    int rank = tierRank(tier);
                    if (rank > bestRank) {
                        bestRank = rank;
                        best = verified;
                        bestToken = purchase.getPurchaseToken();
                    } else if (rank == bestRank && rank > 0 && best != null) {
                        long currentExpiry = parseIsoMillis(best.optString("expiresAt", ""));
                        long candidateExpiry = parseIsoMillis(verified.optString("expiresAt", ""));
                        if (candidateExpiry > currentExpiry) {
                            best = verified;
                            bestToken = purchase.getPurchaseToken();
                        }
                    }
                } catch (Exception e) {
                    android.util.Log.w("PlayBilling", "Falha ao verificar compra: " + e.getMessage());
                }
            }

            if (best != null && bestToken != null) {
                saveVerifiedPlan(best, bestToken);
                notifyPlanChanged();
                if (fromPurchaseFlow) showToast("Assinatura confirmada e recursos liberados.");
            } else if (serverReached) {
                clearVerifiedPlan();
                notifyPlanChanged();
                if (fromPurchaseFlow && !pendingFound) {
                    showToast("O pagamento foi localizado, mas ainda não liberou uma assinatura válida.");
                }
            } else {
                notifyPlanChanged();
                if (fromPurchaseFlow && !pendingFound) {
                    showToast("Compra recebida. A liberação será concluída assim que a validação online estiver disponível.");
                }
            }
        }).start();
    }

    private JSONObject verifyPurchaseOnServer(String purchaseToken) throws Exception {
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(BILLING_VERIFY_URL).openConnection();
            connection.setConnectTimeout(12000);
            connection.setReadTimeout(15000);
            connection.setRequestMethod("POST");
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json");
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("apikey", SUPABASE_PUBLISHABLE_KEY);

            JSONObject request = new JSONObject();
            request.put("purchaseToken", purchaseToken);
            byte[] body = request.toString().getBytes(StandardCharsets.UTF_8);
            try (OutputStream output = connection.getOutputStream()) {
                output.write(body);
            }

            int code = connection.getResponseCode();
            InputStream stream = code >= 200 && code < 300
                    ? connection.getInputStream()
                    : connection.getErrorStream();
            String response = readStream(stream);

            if (code < 200 || code >= 300) {
                throw new Exception("billing_backend_http_" + code + ":" + response);
            }
            return new JSONObject(response);
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private String readStream(InputStream input) throws Exception {
        if (input == null) return "";
        StringBuilder out = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(input, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) out.append(line);
        }
        return out.toString();
    }

    private void saveVerifiedPlan(JSONObject verified, String purchaseToken) {
        String tier = verified.optString("tier", "free");
        long expiry = parseIsoMillis(verified.optString("expiresAt", ""));
        long now = System.currentTimeMillis();

        getSharedPreferences(PLAN_PREFS, MODE_PRIVATE).edit()
                .putString(PLAN_KEY, tier)
                .putLong(PLAN_TIME_KEY, now)
                .putLong(PLAN_EXPIRY_KEY, expiry)
                .putString(PLAN_STATE_KEY, verified.optString("subscriptionState", ""))
                .putString(PLAN_PRODUCT_KEY, verified.optString("productId", ""))
                .putString(PLAN_BASE_KEY, verified.optString("basePlanId", ""))
                .putBoolean(PLAN_AUTORENEW_KEY, verified.optBoolean("autoRenew", false))
                .apply();

        try {
            saveEncrypted(BILLING_TOKEN_PREF_KEY, purchaseToken);
        } catch (Exception ignored) {}
    }

    private void clearVerifiedPlan() {
        getSharedPreferences(PLAN_PREFS, MODE_PRIVATE).edit().clear().apply();
        getSharedPreferences(PLAN_PREFS, MODE_PRIVATE).edit().putString(PLAN_KEY, "free").apply();
        try {
            clearEncrypted(BILLING_TOKEN_PREF_KEY);
        } catch (Exception ignored) {}
    }

    private long parseIsoMillis(String value) {
        if (value == null || value.isEmpty()) return 0L;
        String[] patterns = new String[]{
                "yyyy-MM-dd'T'HH:mm:ss.SSSSSSX",
                "yyyy-MM-dd'T'HH:mm:ss.SSSX",
                "yyyy-MM-dd'T'HH:mm:ssX"
        };
        for (String pattern : patterns) {
            try {
                SimpleDateFormat f = new SimpleDateFormat(pattern, Locale.US);
                Date d = f.parse(value);
                if (d != null) return d.getTime();
            } catch (Exception ignored) {}
        }
        return 0L;
    }

    private String formatIsoMillis(long value) {
        if (value <= 0L) return "";
        SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        f.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
        return f.format(new Date(value));
    }

    private int tierRank(String tier) {
        if ("pro_cloud".equals(tier)) return 2;
        if ("professional".equals(tier)) return 1;
        return 0;
    }

    private String tierForProduct(String productId) {
        if (PRODUCT_CLOUD.equals(productId)) return "pro_cloud";
        if (PRODUCT_PROFESSIONAL.equals(productId)) return "professional";
        return "free";
    }

    private String effectiveCachedTier() {
        String tier = getSharedPreferences(PLAN_PREFS, MODE_PRIVATE).getString(PLAN_KEY, "free");
        long expiry = getSharedPreferences(PLAN_PREFS, MODE_PRIVATE).getLong(PLAN_EXPIRY_KEY, 0L);
        if (!"free".equals(tier) && expiry > 0L && System.currentTimeMillis() >= expiry) {
            return "free";
        }
        return tier == null ? "free" : tier;
    }

    private String planStatusJson() {
        try {
            JSONObject j = new JSONObject();
            j.put("tier", effectiveCachedTier());
            j.put("billingReady", billingReady);
            j.put("source", "server_verified_cache");
            j.put("verifiedAt", getSharedPreferences(PLAN_PREFS, MODE_PRIVATE).getLong(PLAN_TIME_KEY, 0L));
            long expiry = getSharedPreferences(PLAN_PREFS, MODE_PRIVATE).getLong(PLAN_EXPIRY_KEY, 0L);
            j.put("expiresAt", expiry > 0 ? formatIsoMillis(expiry) : JSONObject.NULL);
            j.put("subscriptionState", getSharedPreferences(PLAN_PREFS, MODE_PRIVATE).getString(PLAN_STATE_KEY, ""));
            j.put("productId", getSharedPreferences(PLAN_PREFS, MODE_PRIVATE).getString(PLAN_PRODUCT_KEY, ""));
            j.put("basePlanId", getSharedPreferences(PLAN_PREFS, MODE_PRIVATE).getString(PLAN_BASE_KEY, ""));
            j.put("autoRenew", getSharedPreferences(PLAN_PREFS, MODE_PRIVATE).getBoolean(PLAN_AUTORENEW_KEY, false));
            return j.toString();
        } catch (Exception e) {
            return "{\"tier\":\"free\",\"billingReady\":false}";
        }
    }

    private void notifyPlanChanged() {
        if (webView == null) return;
        final String json = planStatusJson();
        runOnUiThread(() -> webView.evaluateJavascript(
                "window.PlayStoreFeatures&&PlayStoreFeatures.onNativePlanChanged(" + json + ");",
                null));
    }

    private void notifyCatalogChanged() {
        if (webView == null) return;
        final String json = productCatalogJson;
        runOnUiThread(() -> webView.evaluateJavascript(
                "window.PlayStoreFeatures&&PlayStoreFeatures.onCatalogChanged(" + json + ");",
                null));
    }

    private ProductDetails.SubscriptionOfferDetails offerForBasePlan(
            ProductDetails details, String basePlanId) {
        List<ProductDetails.SubscriptionOfferDetails> offers = details.getSubscriptionOfferDetails();
        if (offers == null || offers.isEmpty()) return null;

        ProductDetails.SubscriptionOfferDetails fallback = null;
        for (ProductDetails.SubscriptionOfferDetails offer : offers) {
            if (fallback == null && offer.getOfferId() == null) fallback = offer;
            if (basePlanId != null && basePlanId.equals(offer.getBasePlanId()) && offer.getOfferId() == null) {
                return offer;
            }
        }
        if (basePlanId != null) {
            for (ProductDetails.SubscriptionOfferDetails offer : offers) {
                if (basePlanId.equals(offer.getBasePlanId())) return offer;
            }
        }
        return fallback != null ? fallback : offers.get(0);
    }

    private Purchase currentPurchasedSubscription() {
        for (Purchase purchase : ownedPurchases) {
            if (purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED) return purchase;
        }
        return null;
    }

    private void buyPlanNative(String tier, String basePlanId) {
        String productId = "pro_cloud".equals(tier) ? PRODUCT_CLOUD :
                ("professional".equals(tier) ? PRODUCT_PROFESSIONAL : null);
        if (productId == null) {
            showToast("Plano inválido.");
            return;
        }
        if (!BASE_MONTHLY.equals(basePlanId) && !BASE_YEARLY.equals(basePlanId)) {
            basePlanId = BASE_MONTHLY;
        }
        if (billingClient == null || !billingReady) {
            showToast("A Google Play ainda não está pronta. Verifique sua conexão e tente novamente.");
            return;
        }

        ProductDetails details = productDetailsMap.get(productId);
        if (details == null) {
            queryProductCatalog();
            showToast("Atualizando os preços da Google Play. Tente novamente em alguns segundos.");
            return;
        }

        ProductDetails.SubscriptionOfferDetails offer = offerForBasePlan(details, basePlanId);
        if (offer == null) {
            showToast("Esse período de assinatura ainda não está disponível.");
            return;
        }

        Purchase current = currentPurchasedSubscription();

        BillingFlowParams.ProductDetailsParams.Builder productBuilder =
                BillingFlowParams.ProductDetailsParams.newBuilder()
                        .setProductDetails(details)
                        .setOfferToken(offer.getOfferToken());

        BillingFlowParams.Builder flowBuilder = BillingFlowParams.newBuilder();

        if (current != null && !current.getProducts().contains(productId)) {
            boolean upgrading = "pro_cloud".equals(tier);
            int replacementMode = upgrading
                    ? BillingFlowParams.ProductDetailsParams.SubscriptionProductReplacementParams.ReplacementMode.CHARGE_PRORATED_PRICE
                    : BillingFlowParams.ProductDetailsParams.SubscriptionProductReplacementParams.ReplacementMode.DEFERRED;

            String oldProductId = current.getProducts().isEmpty()
                    ? ("pro_cloud".equals(tier) ? PRODUCT_PROFESSIONAL : PRODUCT_CLOUD)
                    : current.getProducts().get(0);

            productBuilder.setSubscriptionProductReplacementParams(
                    BillingFlowParams.ProductDetailsParams.SubscriptionProductReplacementParams.newBuilder()
                            .setOldProductId(oldProductId)
                            .setReplacementMode(replacementMode)
                            .build());

            flowBuilder.setSubscriptionUpdateParams(
                    BillingFlowParams.SubscriptionUpdateParams.newBuilder()
                            .setOldPurchaseToken(current.getPurchaseToken())
                            .build());
        }

        BillingFlowParams.ProductDetailsParams productParams = productBuilder.build();
        flowBuilder.setProductDetailsParamsList(Collections.singletonList(productParams));

        BillingResult launchResult = billingClient.launchBillingFlow(this, flowBuilder.build());
        if (launchResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
            showToast("Não foi possível abrir o pagamento: " + launchResult.getDebugMessage());
        }
    }

    private void openSubscriptionCenterNative() {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW,
                    Uri.parse("https://play.google.com/store/account/subscriptions?package=" + getPackageName()));
            startActivity(intent);
        } catch (Exception e) {
            openPlayStoreListing();
        }
    }

    private void openPlayStoreListing() {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=" + getPackageName())));
        } catch (Exception e) {
            startActivity(new Intent(Intent.ACTION_VIEW,
                    Uri.parse("https://play.google.com/store/apps/details?id=" + getPackageName())));
        }
    }

    private void showToast(String text) {
        runOnUiThread(() -> Toast.makeText(MainActivity.this, text, Toast.LENGTH_LONG).show());
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    private String getCurrentVersionName() {
        try {
            String name = getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
            return name == null ? "" : name;
        } catch (Exception e) {
            return "";
        }
    }

    private SecretKey getOrCreateSecureKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);
        if (keyStore.containsAlias(SECURE_KEY_ALIAS)) {
            return ((KeyStore.SecretKeyEntry) keyStore.getEntry(SECURE_KEY_ALIAS, null)).getSecretKey();
        }
        KeyGenerator keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        KeyGenParameterSpec spec = new KeyGenParameterSpec.Builder(
                SECURE_KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .build();
        keyGenerator.init(spec);
        return keyGenerator.generateKey();
    }

    private void saveEncrypted(String prefKey, String value) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateSecureKey());
        byte[] encrypted = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
        String stored = Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP) + ":" +
                Base64.encodeToString(encrypted, Base64.NO_WRAP);
        getSharedPreferences(SECURE_PREFS, MODE_PRIVATE).edit().putString(prefKey, stored).commit();
    }

    private String loadEncrypted(String prefKey) {
        try {
            String value = getSharedPreferences(SECURE_PREFS, MODE_PRIVATE).getString(prefKey, null);
            if (value == null || !value.contains(":")) return null;
            String[] parts = value.split(":", 2);
            byte[] iv = Base64.decode(parts[0], Base64.NO_WRAP);
            byte[] encrypted = Base64.decode(parts[1], Base64.NO_WRAP);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, getOrCreateSecureKey(), new GCMParameterSpec(128, iv));
            return new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8);
        } catch (Exception e) {
            return null;
        }
    }

    private void clearEncrypted(String prefKey) {
        getSharedPreferences(SECURE_PREFS, MODE_PRIVATE).edit().remove(prefKey).commit();
    }

    private void saveAuthSessionEncrypted(String json) throws Exception {
        saveEncrypted(AUTH_PREF_KEY, json);
    }

    private String loadAuthSessionEncrypted() {
        return loadEncrypted(AUTH_PREF_KEY);
    }

    private void clearAuthSessionEncrypted() {
        clearEncrypted(AUTH_PREF_KEY);
    }

    public class AndroidBridge {
        private final Context context;
        AndroidBridge(Context context) { this.context = context; }

        @JavascriptInterface
        public void saveAuthSession(String json) {
            try { saveAuthSessionEncrypted(json); } catch (Exception ignored) {}
        }

        @JavascriptInterface
        public String loadAuthSession() { return loadAuthSessionEncrypted(); }

        @JavascriptInterface
        public void clearAuthSession() { clearAuthSessionEncrypted(); }

        @JavascriptInterface
        public String appVersion() { return getCurrentVersionName(); }

        @JavascriptInterface
        public String getPlanStatus() { return planStatusJson(); }

        @JavascriptInterface
        public String getProductCatalog() { return productCatalogJson; }

        @JavascriptInterface
        public String getPurchaseToken() {
            String token = loadEncrypted(BILLING_TOKEN_PREF_KEY);
            return token == null ? "" : token;
        }

        @JavascriptInterface
        public void buyPlan(String tier, String basePlanId) {
            runOnUiThread(() -> buyPlanNative(tier, basePlanId));
        }

        @JavascriptInterface
        public void restorePurchases() {
            runOnUiThread(() -> queryOwnedSubscriptions(true));
        }

        @JavascriptInterface
        public void refreshBillingCatalog() {
            runOnUiThread(MainActivity.this::queryProductCatalog);
        }

        @JavascriptInterface
        public void openSubscriptionCenter() {
            runOnUiThread(MainActivity.this::openSubscriptionCenterNative);
        }

        @JavascriptInterface
        public void checkForUpdates() {
            runOnUiThread(MainActivity.this::openPlayStoreListing);
        }

        @JavascriptInterface
        public void openExternalUrl(String url) {
            runOnUiThread(() -> {
                try {
                    Uri uri = Uri.parse(url);
                    if (!"https".equalsIgnoreCase(uri.getScheme())) {
                        showToast("Link inválido.");
                        return;
                    }
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (Exception e) {
                    showToast("Não foi possível abrir o link.");
                }
            });
        }

        @JavascriptInterface
        public void exportBackup(String json, String fileName) {
            pendingBackupJson = json;
            runOnUiThread(() -> {
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("application/json");
                intent.putExtra(Intent.EXTRA_TITLE,
                        (fileName == null || fileName.trim().isEmpty()) ? "MarcenariaPro_Backup.json" : fileName);
                startActivityForResult(intent, BACKUP_CREATE_CODE);
            });
        }

        @JavascriptInterface
        public void importBackup() {
            runOnUiThread(() -> {
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("application/json");
                startActivityForResult(intent, BACKUP_OPEN_CODE);
            });
        }

        @JavascriptInterface
        public void savePdf(String dataUri, String fileName) {
            try {
                String data = dataUri;
                int comma = dataUri.indexOf(',');
                if (comma >= 0) data = dataUri.substring(comma + 1);
                byte[] pdfBytes = Base64.decode(data, Base64.DEFAULT);
                if (!fileName.toLowerCase().endsWith(".pdf")) fileName += ".pdf";

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
                    values.put(MediaStore.Downloads.MIME_TYPE, "application/pdf");
                    values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/MarcenariaPro");
                    Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                    if (uri == null) throw new Exception("Não foi possível criar o arquivo.");
                    try (OutputStream os = getContentResolver().openOutputStream(uri)) {
                        if (os == null) throw new Exception("Não foi possível abrir o arquivo.");
                        os.write(pdfBytes);
                    }
                } else {
                    if (checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                        requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, STORAGE_PERMISSION_CODE);
                        showToast("Permita o armazenamento e tente novamente.");
                        return;
                    }
                    File downloads = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                    File dir = new File(downloads, "MarcenariaPro");
                    if (!dir.exists()) dir.mkdirs();
                    try (FileOutputStream fos = new FileOutputStream(new File(dir, fileName))) {
                        fos.write(pdfBytes);
                    }
                }
                String savedName = fileName;
                showToast("PDF salvo em Downloads/MarcenariaPro: " + savedName);
            } catch (Exception e) {
                showToast("Erro ao salvar PDF: " + e.getMessage());
            }
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (resultCode != RESULT_OK || data == null || data.getData() == null) return;

        Uri uri = data.getData();
        if (requestCode == BACKUP_CREATE_CODE) {
            String json = pendingBackupJson;
            pendingBackupJson = null;
            if (json == null) return;
            try (OutputStream out = getContentResolver().openOutputStream(uri)) {
                if (out == null) throw new Exception("Não foi possível abrir o destino.");
                out.write(json.getBytes(StandardCharsets.UTF_8));
                out.flush();
                showToast("Backup local salvo.");
            } catch (Exception e) {
                showToast("Erro ao salvar backup: " + e.getMessage());
            }
            return;
        }

        if (requestCode == BACKUP_OPEN_CODE) {
            try (InputStream input = getContentResolver().openInputStream(uri)) {
                String json = readStream(input);
                final String quoted = JSONObject.quote(json);
                runOnUiThread(() -> webView.evaluateJavascript(
                        "window.PlayStoreFeatures&&PlayStoreFeatures.onBackupImported(" + quoted + ");", null));
            } catch (Exception e) {
                showToast("Erro ao abrir backup: " + e.getMessage());
            }
        }
    }

    @Override
    protected void onDestroy() {
        if (billingClient != null) billingClient.endConnection();
        if (webView != null) {
            webView.removeJavascriptInterface("AndroidApp");
            webView.destroy();
        }
        super.onDestroy();
    }
}
