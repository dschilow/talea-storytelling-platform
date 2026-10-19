package com.talea.app;

import android.content.res.AssetManager;
import android.net.Uri;
import android.webkit.MimeTypeMap;
import android.webkit.WebResourceResponse;
import org.json.JSONObject;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.io.FilterInputStream;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

/** HTTPS origin preserves Clerk, IndexedDB, camera and WebGL support.
 * Only the app shell and packaged public files are intercepted. APIs and Clerk
 * continue to use HTTPS with their normal authentication and TLS validation. */
public final class TaleaWebAssets {
    private final AssetManager assets;
    private final JSONObject files;

    public TaleaWebAssets(AssetManager assets) {
        this.assets = assets;
        JSONObject index;
        try (InputStream stream = assets.open("talea/native-assets.json")) {
            index = new JSONObject(new String(readAll(stream), "UTF-8")).getJSONObject("files");
        } catch (Exception error) { index = new JSONObject(); }
        files = index;
    }

    public WebResourceResponse intercept(Uri uri, String method, boolean mainFrame, Map<String, String> requestHeaders) {
        if (!"https".equals(uri.getScheme()) || !"www.talea.website".equals(uri.getHost()) ||
            (uri.getPort() != -1 && uri.getPort() != 443) || !"GET".equals(method)) return null;
        String decoded = uri.getPath();
        if (decoded == null || decoded.contains("\\") || decoded.contains("\u0000")) return empty(400, "Bad Request");
        for (String segment : decoded.split("/")) if ("..".equals(segment)) return empty(400, "Bad Request");
        String file = decoded.replaceFirst("^/", "");
        if (!files.has(file)) {
            if (mainFrame && !file.contains(".") && !file.startsWith("__clerk")) file = "index.html";
            else return null;
        }
        try {
            long length = files.getJSONObject(file).getLong("bytes");
            String extension = MimeTypeMap.getFileExtensionFromUrl(file);
            String mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension);
            if ("js".equals(extension) || "mjs".equals(extension)) mime = "application/javascript";
            if ("woff2".equals(extension)) mime = "font/woff2";
            if ("json".equals(extension)) mime = "application/json";
            if (mime == null) mime = "application/octet-stream";
            Map<String, String> headers = new HashMap<>();
            headers.put("Cache-Control", "no-store");
            headers.put("X-Content-Type-Options", "nosniff");
            headers.put("Accept-Ranges", "bytes");
            String range = null;
            for (Map.Entry<String, String> header : requestHeaders.entrySet()) {
                if ("range".equalsIgnoreCase(header.getKey())) range = header.getValue();
            }
            long start = 0, end = length - 1;
            int status = 200;
            if (range != null && range.matches("bytes=\\d*-\\d*")) {
                String[] parts = range.substring(6).split("-", -1);
                if (parts[0].isEmpty()) start = Math.max(0, length - Long.parseLong(parts[1]));
                else start = Long.parseLong(parts[0]);
                if (!parts[0].isEmpty() && !parts[1].isEmpty()) end = Math.min(end, Long.parseLong(parts[1]));
                if (start > end || start >= length) {
                    headers.put("Content-Range", "bytes */" + length);
                    return new WebResourceResponse("text/plain", "UTF-8", 416, "Range Not Satisfiable", headers, new ByteArrayInputStream(new byte[0]));
                }
                status = 206;
                headers.put("Content-Range", "bytes " + start + "-" + end + "/" + length);
            }
            InputStream stream = assets.open("talea/" + file);
            long skipped = 0;
            while (skipped < start) {
                long step = stream.skip(start - skipped);
                if (step <= 0) { stream.close(); return empty(500, "Read Error"); }
                skipped += step;
            }
            final long count = end - start + 1;
            headers.put("Content-Length", Long.toString(count));
            InputStream limited = new FilterInputStream(stream) {
                long remaining = count;
                @Override public int read() throws IOException {
                    if (remaining <= 0) return -1;
                    int value = super.read();
                    if (value >= 0) remaining--;
                    return value;
                }
                @Override public int read(byte[] b, int off, int len) throws IOException {
                    if (remaining <= 0) return -1;
                    int n = in.read(b, off, (int) Math.min(len, remaining));
                    if (n > 0) remaining -= n;
                    return n;
                }
            };
            return new WebResourceResponse(mime, "UTF-8", status, status == 206 ? "Partial Content" : "OK", headers, limited);
        } catch (Exception error) { return empty(500, "Asset Read Error"); }
    }

    private static WebResourceResponse empty(int status, String reason) {
        return new WebResourceResponse("text/plain", "UTF-8", status, reason, new HashMap<>(), new ByteArrayInputStream(new byte[0]));
    }
    private static byte[] readAll(InputStream stream) throws IOException {
        java.io.ByteArrayOutputStream output = new java.io.ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int n;
        while ((n = stream.read(buffer)) != -1) output.write(buffer, 0, n);
        return output.toByteArray();
    }
}
