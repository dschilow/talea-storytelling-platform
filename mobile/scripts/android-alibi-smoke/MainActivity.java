package com.talea.alibiqa;

import android.app.Activity;
import android.os.Bundle;
import android.util.Log;
import android.webkit.*;
import android.content.SharedPreferences;
import org.json.*;
import java.nio.charset.StandardCharsets;

/** Isolated test APK: uses the game's QA bundle and a fixture pool, never Clerk. */
public class MainActivity extends Activity {
  WebView web;
  SharedPreferences storage;
  boolean testing = false;
  String asset(String name) throws Exception {
    try (java.io.InputStream input = getAssets().open(name); java.io.ByteArrayOutputStream output = new java.io.ByteArrayOutputStream()) {
      byte[] buffer = new byte[8192]; int count;
      while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
      return new String(output.toByteArray(), StandardCharsets.UTF_8);
    }
  }
  void reply(JSONObject message) { web.evaluateJavascript("window.__alibiReceive(" + message + ");", null); }
  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    if (android.os.Build.VERSION.SDK_INT >= 27) { setShowWhenLocked(true); setTurnScreenOn(true); }
    storage = getSharedPreferences("alibi", MODE_PRIVATE);
    storage.edit().clear().commit();
    web = new WebView(this);
    WebView.setWebContentsDebuggingEnabled(true);
    WebSettings s = web.getSettings();
    s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true);
    s.setAllowFileAccess(true); s.setAllowFileAccessFromFileURLs(true);
    s.setAllowUniversalAccessFromFileURLs(false); s.setMediaPlaybackRequiresUserGesture(false);
    web.setWebViewClient(new WebViewClient());
    web.setWebChromeClient(new WebChromeClient() {
      @Override public boolean onConsoleMessage(ConsoleMessage m) {
        if (m.message().startsWith("ALIBI_QA:")) Log.i("AlibiQA", m.message());
        else if (m.messageLevel() == ConsoleMessage.MessageLevel.ERROR) Log.e("AlibiQA", "ALIBI_QA:ERROR " + m.message());
        return true;
      }
    });
    web.addJavascriptInterface(new Object() {
      @JavascriptInterface public void postMessage(String raw) {
        runOnUiThread(() -> {
          try {
            JSONObject m = new JSONObject(raw), value = new JSONObject();
            String type = m.getString("type");
            if (type.equals("ready") || type.equals("characters")) Log.i("AlibiQA", "ALIBI_QA: " + type);
            switch (type) {
              case "bootstrap":
                for (String key : storage.getAll().keySet()) value.put(key, storage.getString(key, null));
                break;
              case "characters":
                value = new JSONObject(asset("pool.json"));
                // Mirror the native host's cached portrait URIs, including the
                // private app-directory/file:// boundary used by the live board.
                java.io.File directory = new java.io.File(getFilesDir(), "portraits");
                directory.mkdirs();
                JSONArray pool = value.getJSONArray("characters");
                for (int i = 0; i < pool.length(); i++) {
                  JSONObject c = pool.getJSONObject(i);
                  String from = c.getString("imageUrl");
                  java.io.File image = new java.io.File(directory, from.substring(from.lastIndexOf('/') + 1));
                  if (!image.exists()) {
                    try (java.io.InputStream input = getAssets().open("alibi/" + from); java.io.FileOutputStream output = new java.io.FileOutputStream(image)) {
                      byte[] buffer = new byte[8192]; int count;
                      while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
                    }
                  }
                  c.put("imageUrl", "file://" + image.getAbsolutePath());
                }
                break;
              case "save": storage.edit().putString(m.getString("key"), m.getString("value")).commit(); break;
              case "error": Log.e("AlibiQA", "ALIBI_QA:ERROR " + m.optString("message")); break;
              case "ready":
                if (!testing) {
                  testing = true;
                  web.postDelayed(() -> {
                    try { web.evaluateJavascript(asset("checks.js"), null); }
                    catch (Exception e) { Log.e("AlibiQA", "ALIBI_QA:ERROR " + e); }
                  }, 1000);
                }
                break;
            }
            if (m.has("id")) reply(new JSONObject().put("id", m.getInt("id")).put("value", value));
          } catch (Exception e) { Log.e("AlibiQA", "ALIBI_QA:ERROR " + e); }
        });
      }
    }, "ReactNativeWebView");
    setContentView(web);
    web.loadUrl("file:///android_asset/alibi/index.html");
  }
  @Override public void onBackPressed() { web.evaluateJavascript("window.__alibiBack?.();", null); }
  @Override protected void onPause() { web.evaluateJavascript("window.__alibiLifecycle?.(false);", null); super.onPause(); }
  @Override protected void onResume() { super.onResume(); if (web != null) web.evaluateJavascript("window.__alibiLifecycle?.(true);", null); }
}
