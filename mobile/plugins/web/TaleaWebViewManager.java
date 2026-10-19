package com.talea.app;

import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import androidx.annotation.NonNull;
import com.facebook.react.uimanager.ThemedReactContext;
import com.reactnativecommunity.webview.RNCWebViewClient;
import com.reactnativecommunity.webview.RNCWebViewManager;
import com.reactnativecommunity.webview.RNCWebViewWrapper;

public class TaleaWebViewManager extends RNCWebViewManager {
    @Override
    protected void addEventEmitters(@NonNull ThemedReactContext context, RNCWebViewWrapper view) {
        final TaleaWebAssets assets = new TaleaWebAssets(context.getAssets());
        view.getWebView().setWebViewClient(new RNCWebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView webView, WebResourceRequest request) {
                // Clerk/CAPTCHA iframes navigate normally. Only top-level links
                // participate in the app's native/external navigation policy.
                return request.isForMainFrame() && super.shouldOverrideUrlLoading(webView, request);
            }
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView webView, WebResourceRequest request) {
                WebResourceResponse local = assets.intercept(request.getUrl(), request.getMethod(), request.isForMainFrame(), request.getRequestHeaders());
                return local != null ? local : super.shouldInterceptRequest(webView, request);
            }
        });
    }
}
