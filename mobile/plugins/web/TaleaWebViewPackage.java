package com.talea.app;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;
import com.reactnativecommunity.webview.RNCWebViewPackage;
import java.util.Collections;
import java.util.List;

/** Retain the upstream WebView's Fabric component, props, events and commands. */
public class TaleaWebViewPackage extends RNCWebViewPackage {
    @Override
    public List<ViewManager> createViewManagers(ReactApplicationContext context) {
        return Collections.singletonList(new TaleaWebViewManager());
    }
}
