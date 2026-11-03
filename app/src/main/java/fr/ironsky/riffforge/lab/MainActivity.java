package fr.ironsky.riffforge.lab;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.FrameLayout;

public final class MainActivity extends Activity {
    private static final int AUDIO_PICKER_REQUEST = 124;
    private WebView webView;
    private ValueCallbackHolder picker;

    private static final class ValueCallbackHolder {
        private final android.webkit.ValueCallback<Uri[]> callback;
        private ValueCallbackHolder(android.webkit.ValueCallback<Uri[]> cb) { callback = cb; }
        private void finish(Uri[] uris) { callback.onReceiveValue(uris); }
    }

    // Exposed to the page as window.RiffAndroid; only the packaged local assets are ever loaded.
    private final class Bridge {
        @JavascriptInterface public void keepScreenOn(boolean on) {
            runOnUiThread(() -> {
                if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            });
        }
    }

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(11, 11, 12));
        getWindow().setNavigationBarColor(Color.rgb(11, 11, 12));
        if (Build.VERSION.SDK_INT >= 30) getWindow().setDecorFitsSystemWindows(false);
        else getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(11, 11, 12));
        webView = new WebView(this);
        root.addView(webView, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);

        // Reserve the actual Android status/navigation/gesture-bar/IME insets.
        // This avoids drawing Riff Forge's own controls beneath Android navigation.
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets safe = insets.getInsets(
                    WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                v.setPadding(safe.left, safe.top, safe.right, safe.bottom);
            } else {
                v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                    insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
        root.requestApplyInsets();

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true); // Only packaged local assets.
        s.setAllowContentAccess(true); // Android document picker URIs.
        s.setAllowFileAccessFromFileURLs(false);
        s.setAllowUniversalAccessFromFileURLs(false);
        s.setMediaPlaybackRequiresUserGesture(true);

        webView.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view,
                android.webkit.ValueCallback<Uri[]> filePathCallback, FileChooserParams params) {
                if (picker != null) { picker.finish(null); picker = null; }
                picker = new ValueCallbackHolder(filePathCallback);
                try {
                    Intent intent = params.createIntent();
                    startActivityForResult(intent, AUDIO_PICKER_REQUEST);
                    return true;
                } catch (Exception ex) {
                    picker.finish(null); picker = null;
                    return false;
                }
            }
        });
        webView.setBackgroundColor(Color.rgb(11, 11, 12));
        webView.addJavascriptInterface(new Bridge(), "RiffAndroid");
        webView.loadUrl("file:///android_asset/index.html");
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == AUDIO_PICKER_REQUEST && picker != null) {
            picker.finish(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            picker = null;
        }
    }

    // Back returns to the Atelier tab first (handled by window.RiffBack), and quits only from there.
    @Override public void onBackPressed() {
        if (webView == null) { super.onBackPressed(); return; }
        webView.evaluateJavascript("typeof RiffBack==='function'&&RiffBack()", handled -> {
            if (!"true".equals(handled) && !isFinishing()) MainActivity.super.onBackPressed();
        });
    }

    @Override protected void onDestroy() {
        if (picker != null) { picker.finish(null); picker = null; }
        if (webView != null) { webView.destroy(); webView = null; }
        super.onDestroy();
    }
}
