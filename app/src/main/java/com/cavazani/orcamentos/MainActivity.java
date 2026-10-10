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

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.Collections;
import java.util.List;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

public class MainActivity extends Activity {
    private WebView webView;
    private BillingClient billingClient;
    private boolean billingReady = false;

    private static final int STORAGE_PERMISSION_CODE = 71;
    private static final String AUTH_PREFS = "marcenaria_pro_secure_state";
    private static final String AUTH_PREF_KEY = "supabase_auth_session";
    private static final String AUTH_KEY_ALIAS = "marcenaria_pro_auth_key";
    private static final String PLAN_PREFS = "marcenaria_pro_plan";
    private static final String PLAN_KEY = "tier";
    private static final String PLAN_TIME_KEY = "verified_at";

    private static final String PRODUCT_PROFESSIONAL = "plano_profissional_mensal";
    private static final String PRODUCT_CLOUD = "plano_pro_nuvem_mensal";

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
                if (billingReady) queryOwnedSubscriptions();
                else notifyPlanChanged();
            }

            @Override
            public void onBillingServiceDisconnected() {
                billingReady = false;
                notifyPlanChanged();
            }
        });
    }

    private void onPurchasesUpdated(BillingResult billingResult, List<Purchase> purchases) {
        if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK && purchases != null) {
            processPurchases(purchases, true);
        } else if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.USER_CANCELED) {
            showToast("Não foi possível concluir a compra: " + billingResult.getDebugMessage());
        }
    }

    private void queryOwnedSubscriptions() {
        if (billingClient == null || !billingReady) {
            notifyPlanChanged();
            return;
        }
        QueryPurchasesParams params = QueryPurchasesParams.newBuilder()
                .setProductType(BillingClient.ProductType.SUBS)
                .build();

        billingClient.queryPurchasesAsync(params, (billingResult, purchases) -> {
            if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                processPurchases(purchases, false);
            } else {
                notifyPlanChanged();
            }
        });
    }

    private void processPurchases(List<Purchase> purchases, boolean fromPurchaseFlow) {
        String tier = "free";
        if (purchases != null) {
            for (Purchase purchase : purchases) {
                if (purchase.getPurchaseState() != Purchase.PurchaseState.PURCHASED) continue;

                List<String> products = purchase.getProducts();
                if (products.contains(PRODUCT_CLOUD)) tier = "pro_cloud";
                else if (products.contains(PRODUCT_PROFESSIONAL) && !"pro_cloud".equals(tier)) tier = "professional";

                if (!purchase.isAcknowledged()) {
                    AcknowledgePurchaseParams ack = AcknowledgePurchaseParams.newBuilder()
                            .setPurchaseToken(purchase.getPurchaseToken())
                            .build();
                    billingClient.acknowledgePurchase(ack, result -> {
                        if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                            showToast("Compra recebida, mas a confirmação ficou pendente.");
                        }
                    });
                }
            }
        }

        saveTier(tier);
        notifyPlanChanged();
        if (fromPurchaseFlow && !"free".equals(tier)) {
            showToast("Plano liberado com sucesso.");
        }
    }

    private void saveTier(String tier) {
        getSharedPreferences(PLAN_PREFS, MODE_PRIVATE).edit()
                .putString(PLAN_KEY, tier)
                .putLong(PLAN_TIME_KEY, System.currentTimeMillis())
                .apply();
    }

    private String cachedTier() {
        return getSharedPreferences(PLAN_PREFS, MODE_PRIVATE).getString(PLAN_KEY, "free");
    }

    private String planStatusJson() {
        try {
            JSONObject j = new JSONObject();
            j.put("tier", cachedTier());
            j.put("billingReady", billingReady);
            j.put("source", billingReady ? "google_play_device" : "cached");
            j.put("verifiedAt", getSharedPreferences(PLAN_PREFS, MODE_PRIVATE).getLong(PLAN_TIME_KEY, 0L));
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

    private String productForTier(String tier) {
        if ("pro_cloud".equals(tier)) return PRODUCT_CLOUD;
        if ("professional".equals(tier)) return PRODUCT_PROFESSIONAL;
        return null;
    }

    private void buyPlanNative(String tier) {
        String productId = productForTier(tier);
        if (productId == null) {
            showToast("Plano inválido.");
            return;
        }
        if (billingClient == null || !billingReady) {
            showToast("A Google Play ainda não está pronta. Verifique sua conexão e tente novamente.");
            return;
        }

        QueryProductDetailsParams.Product product = QueryProductDetailsParams.Product.newBuilder()
                .setProductId(productId)
                .setProductType(BillingClient.ProductType.SUBS)
                .build();

        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                .setProductList(Collections.singletonList(product))
                .build();

        billingClient.queryProductDetailsAsync(params, new ProductDetailsResponseListener() {
            @Override
            public void onProductDetailsResponse(BillingResult billingResult, QueryProductDetailsResult result) {
                if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK ||
                        result.getProductDetailsList().isEmpty()) {
                    showToast("Esse plano ainda não está disponível na Google Play.");
                    return;
                }

                ProductDetails details = result.getProductDetailsList().get(0);
                List<ProductDetails.SubscriptionOfferDetails> offers = details.getSubscriptionOfferDetails();
                if (offers == null || offers.isEmpty()) {
                    showToast("Nenhuma oferta disponível para este plano.");
                    return;
                }

                BillingFlowParams.ProductDetailsParams productParams =
                        BillingFlowParams.ProductDetailsParams.newBuilder()
                                .setProductDetails(details)
                                .setOfferToken(offers.get(0).getOfferToken())
                                .build();

                BillingFlowParams flow = BillingFlowParams.newBuilder()
                        .setProductDetailsParamsList(Collections.singletonList(productParams))
                        .build();

                runOnUiThread(() -> {
                    BillingResult launchResult = billingClient.launchBillingFlow(MainActivity.this, flow);
                    if (launchResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                        showToast("Não foi possível abrir a compra: " + launchResult.getDebugMessage());
                    }
                });
            }
        });
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

    private SecretKey getOrCreateAuthKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);
        if (keyStore.containsAlias(AUTH_KEY_ALIAS)) {
            return ((KeyStore.SecretKeyEntry) keyStore.getEntry(AUTH_KEY_ALIAS, null)).getSecretKey();
        }
        KeyGenerator keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        KeyGenParameterSpec spec = new KeyGenParameterSpec.Builder(
                AUTH_KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .build();
        keyGenerator.init(spec);
        return keyGenerator.generateKey();
    }

    private void saveAuthSessionEncrypted(String json) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateAuthKey());
        byte[] encrypted = cipher.doFinal(json.getBytes(StandardCharsets.UTF_8));
        String value = Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP) + ":" +
                Base64.encodeToString(encrypted, Base64.NO_WRAP);
        getSharedPreferences(AUTH_PREFS, MODE_PRIVATE).edit().putString(AUTH_PREF_KEY, value).commit();
    }

    private String loadAuthSessionEncrypted() {
        try {
            String value = getSharedPreferences(AUTH_PREFS, MODE_PRIVATE).getString(AUTH_PREF_KEY, null);
            if (value == null || !value.contains(":")) return null;
            String[] parts = value.split(":", 2);
            byte[] iv = Base64.decode(parts[0], Base64.NO_WRAP);
            byte[] encrypted = Base64.decode(parts[1], Base64.NO_WRAP);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, getOrCreateAuthKey(), new GCMParameterSpec(128, iv));
            return new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8);
        } catch (Exception e) {
            return null;
        }
    }

    private void clearAuthSessionEncrypted() {
        getSharedPreferences(AUTH_PREFS, MODE_PRIVATE).edit().remove(AUTH_PREF_KEY).commit();
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
        public void buyPlan(String tier) { runOnUiThread(() -> buyPlanNative(tier)); }

        @JavascriptInterface
        public void restorePurchases() { runOnUiThread(MainActivity.this::queryOwnedSubscriptions); }

        @JavascriptInterface
        public void openSubscriptionCenter() { runOnUiThread(MainActivity.this::openSubscriptionCenterNative); }

        @JavascriptInterface
        public void checkForUpdates() { runOnUiThread(MainActivity.this::openPlayStoreListing); }

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
    protected void onDestroy() {
        if (billingClient != null) billingClient.endConnection();
        if (webView != null) {
            webView.removeJavascriptInterface("AndroidApp");
            webView.destroy();
        }
        super.onDestroy();
    }
}
