package com.vibequeue.kiosk

import android.annotation.SuppressLint
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.view.KeyEvent
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.webkit.JavascriptInterface
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import java.util.Locale

private const val RETRY_DELAY_MS = 5_000L

// The only app this kiosk is allowed to hand off to. A WebView that will
// launch whatever an `intent:` URL names is a launcher for anything installed,
// driven by a remote page; naming the one package we actually print through
// keeps that door shut.
private const val RAWBT_PACKAGE = "ru.a402d.rawbtprinter"

/*
 * How long RawBT gets the foreground before the kiosk takes it back.
 *
 * RawBT is an Activity, so printing necessarily brings it forward and leaves
 * the lobby terminal showing a printer app that the next visitor cannot get
 * out of. Nothing in the web page can prevent that — the hand-off is what
 * prints the ticket. So the kiosk reclaims the foreground itself once the job
 * has had time to reach the printer. Long enough that the spool completes,
 * short enough that the visitor barely registers the flash.
 */
private const val RECLAIM_FOREGROUND_MS = 2_500L

class TtsInterface(context: Context) : TextToSpeech.OnInitListener {
    private val tts = TextToSpeech(context, this)
    private var ready = false

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            tts.language = Locale.US
            ready = true
        }
    }

    @JavascriptInterface
    fun speak(text: String) {
        if (ready) tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "announce")
    }

    fun shutdown() = tts.shutdown()
}

class MainActivity : Activity() {

    private lateinit var webView: WebView
    private lateinit var ttsInterface: TtsInterface
    private val handler = Handler(Looper.getMainLooper())

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        hideSystemUI()

        ttsInterface = TtsInterface(this)

        webView = WebView(this).apply {
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                cacheMode = WebSettings.LOAD_DEFAULT
                mediaPlaybackRequiresUserGesture = false
            }
            addJavascriptInterface(ttsInterface, "AndroidTTS")
            webViewClient = object : WebViewClient() {
                // A WebView cannot follow an `intent:` URL on its own — it
                // fails with ERR_UNKNOWN_URL_SCHEME, which is what silently
                // breaks RawBT printing inside a wrapper. Catch every
                // non-http scheme here and hand it to Android instead.
                override fun shouldOverrideUrlLoading(
                    view: WebView,
                    request: WebResourceRequest,
                ): Boolean = when (request.url.scheme?.lowercase()) {
                    "http", "https" -> false
                    else -> {
                        dispatchToPrinter(request.url)
                        true
                    }
                }

                override fun onReceivedError(
                    view: WebView,
                    request: WebResourceRequest,
                    error: WebResourceError,
                ) {
                    // Only a failed page load is worth retrying. Reloading on
                    // anything else would restart the kiosk under the visitor
                    // every time a hand-off did not resolve.
                    val isPageLoad = request.url.scheme?.lowercase() in setOf("http", "https")
                    if (request.isForMainFrame && isPageLoad) {
                        handler.postDelayed({ view.reload() }, RETRY_DELAY_MS)
                    }
                }
            }
            loadUrl(getString(R.string.start_url))
        }

        setContentView(webView)
    }

    /* Hands a print job to RawBT, then takes the screen back. */
    private fun dispatchToPrinter(uri: Uri) {
        val intent = try {
            Intent.parseUri(uri.toString(), Intent.URI_INTENT_SCHEME)
        } catch (_: Exception) {
            return
        }

        // `parseUri` will happily carry an explicit component or selector out
        // of the page's URL. Strip both and accept only RawBT: the page gets
        // to say "print this", not "start that".
        intent.component = null
        intent.selector = null
        if (intent.`package` != RAWBT_PACKAGE) return

        try {
            startActivity(intent)
        } catch (_: ActivityNotFoundException) {
            // RawBT missing: the ticket is already committed server-side and
            // shown on screen, so there is nothing to recover here — and no
            // reason to leave the kiosk in the background either.
            return
        }
        handler.postDelayed({ reclaimForeground() }, RECLAIM_FOREGROUND_MS)
    }

    /*
     * Brings this activity back to the front. MainActivity is singleTask, so
     * REORDER_TO_FRONT moves the existing instance rather than building a new
     * one — the WebView keeps its page, its scroll position and the ticket the
     * visitor is looking at.
     */
    private fun reclaimForeground() {
        startActivity(
            Intent(this, MainActivity::class.java).apply {
                addFlags(
                    Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP
                )
            }
        )
    }

    override fun onResume() {
        super.onResume()
        // Coming back from RawBT restores the system bars; hide them again or
        // the kiosk ends up with a navigation bar and a way out of it.
        hideSystemUI()
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean =
        if (keyCode == KeyEvent.KEYCODE_BACK) true else super.onKeyDown(keyCode, event)

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        ttsInterface.shutdown()
        webView.destroy()
        super.onDestroy()
    }

    @Suppress("DEPRECATION")
    private fun hideSystemUI() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
            window.insetsController?.let {
                it.hide(WindowInsets.Type.systemBars())
                it.systemBarsBehavior =
                    WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_FULLSCREEN or
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            )
        }
    }
}
