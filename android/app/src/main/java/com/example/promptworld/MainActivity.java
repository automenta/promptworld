package com.example.promptworld;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {

    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main); // Assuming you will create this layout XML

        webView = (WebView) findViewById(R.id.webview); // Assuming webview ID in layout

        // Configure WebView settings
        WebSettings webSettings = webView.getSettings();
        webSettings.setJavaScriptEnabled(true); // Enable JavaScript
        webSettings.setDomStorageEnabled(true); // Enable DOM Storage (localStorage, IndexedDB)
        webSettings.setAllowFileAccessFromFileURLs(true); // Allow file access from file URLs
        webSettings.setAllowUniversalAccessFromFileURLs(true); // Allow universal access from file URLs

        // Set a WebViewClient to handle page navigation within the WebView
        webView.setWebViewClient(new WebViewClient());

        // Load the local HTML file from the assets folder
        // The assets folder in your web project (src/assets) should be copied to
        // the Android project's assets folder (android/app/src/main/assets) during the build process.
        // For now, we assume index.html is directly in android/app/src/main/assets/
        webView.loadUrl("file:///android_asset/index.html");

        // Optional: Add a JavaScriptInterface to bridge Java and JavaScript
        // webView.addJavascriptInterface(new WebAppInterface(this), "Android");
    }

    // Handle back button press to navigate back in WebView history if possible
    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    // Example JavaScriptInterface (optional, for communication between Java and JS)
    /*
    public class WebAppInterface {
        Context mContext;

        WebAppInterface(Context c) {
            mContext = c;
        }

        @JavascriptInterface
        public void showToast(String toast) {
            Toast.makeText(mContext, toast, Toast.LENGTH_SHORT).show();
        }

        // Add more methods here that your JavaScript can call
    }
    */
}

// Note: You'll need to create:
// 1. res/layout/activity_main.xml with a WebView element, e.g.:
/*
<?xml version="1.0" encoding="utf-8"?>
<RelativeLayout xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    tools:context=".MainActivity">

    <WebView
        android:id="@+id/webview"
        android:layout_width="match_parent"
        android:layout_height="match_parent" />
</RelativeLayout>
*/

// 2. res/values/strings.xml with app_name, e.g.:
/*
<resources>
    <string name="app_name">PromptWorld</string>
</resources>
*/

// 3. res/values/styles.xml (or themes.xml) with AppTheme, e.g.:
/*
<resources>
    <style name="AppTheme" parent="android:Theme.Material.Light.NoActionBar">
        <!-- Customize your theme here. -->
    </style>
</resources>
*/

// 4. Potentially mipmap resources for ic_launcher and ic_launcher_round
// These are standard Android project setup items.
// The `android/app/src/main/assets/` directory should contain your web app's
// `index.html`, `scripts.js`, `styles.css`, and any other assets.
// This might involve a build step to copy files from `src/` to `android/app/src/main/assets/`.
