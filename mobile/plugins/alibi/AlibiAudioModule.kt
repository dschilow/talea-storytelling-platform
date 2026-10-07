package com.talea.app

import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.media.MediaPlayer
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import com.facebook.react.bridge.*
import java.util.Locale
import java.io.File

/** MP3 and fallback TTS share a receiver-only private route. Public speech uses
 * USAGE_MEDIA at full clip volume. Secret audio never enters WebView's media path. */
class AlibiSpeechModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context), LifecycleEventListener {
  private val handler = Handler(Looper.getMainLooper())
  private val routing = AlibiAudioRouting(context, handler) { stopInternal(); routingClose() }
  private var engine: TextToSpeech? = null
  private var ready = false
  private var failed = false
  private var foreground = true
  private var counter = 0L
  private val promises = mutableMapOf<String, Promise>()
  private val waiting = mutableListOf<() -> Unit>()
  private var player: MediaPlayer? = null
  private var mediaPromise: Promise? = null
  private var mediaCleanup: (() -> Unit)? = null
  private val synthesized = mutableMapOf<String, Pair<File, Double>>()
  private var playbackPrivate = false
  private var savedVolumeStream: Int? = null

  override fun getName() = "AlibiSpeech"

  init {
    context.addLifecycleEventListener(this)
    handler.post {
      // Recover temporary private TTS files left by a killed app process.
      context.cacheDir.listFiles()?.filter { it.name.startsWith("alibi-speech-") && it.extension == "wav" }?.forEach { it.delete() }
      engine = TextToSpeech(context) { status ->
        handler.post {
          ready = status == TextToSpeech.SUCCESS
          failed = !ready
          engine?.setLanguage(Locale.GERMANY)
          engine?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(id: String?) {}
            override fun onDone(id: String?) { handler.post {
              val result = promises.remove(id)
              val voice = synthesized.remove(id)
              if (result != null && voice != null) {
                mediaPromise = result
                playbackPrivate = true
                val token = counter
                route(true, {
                  if (counter == token && mediaPromise === result) startMedia(true, voice.second, token, { it.setDataSource(voice.first.path) }, { voice.first.delete() })
                  else voice.first.delete()
                }, { voice.first.delete(); if (mediaPromise === result) { mediaPromise = null; result.reject("PRIVATE_ROUTE", it) } })
              } else { voice?.first?.delete(); result?.resolve(null) }
            } }
            @Deprecated("Android callback")
            override fun onError(id: String?) { handler.post { synthesized.remove(id)?.first?.delete(); promises.remove(id)?.reject("TTS_ERROR", "Sprachausgabe fehlgeschlagen") } }
            override fun onStop(id: String?, interrupted: Boolean) { handler.post { synthesized.remove(id)?.first?.delete(); promises.remove(id)?.resolve(null) } }
          })
          val jobs = waiting.toList(); waiting.clear(); jobs.forEach { it() }
        }
      }
    }
  }

  private fun route(priv: Boolean, ready: () -> Unit, failed: (String) -> Unit) {
    if (!foreground) { failed("Spiel pausiert."); return }
    if (priv) routing.open({
      context.currentActivity?.let { activity ->
        if (savedVolumeStream == null) savedVolumeStream = activity.volumeControlStream
        activity.volumeControlStream = AudioManager.STREAM_VOICE_CALL
      }
      ready()
    }, failed)
    else { routingClose(); ready() }
  }

  private fun routingClose() {
    routing.close()
    savedVolumeStream?.let { context.currentActivity?.volumeControlStream = it }
    savedVolumeStream = null
  }

  @ReactMethod
  fun privacy(on: Boolean, promise: Promise) {
    handler.post {
      if (!on) {
        if (playbackPrivate) stopInternal()
        routingClose()
        promise.resolve(null)
      } else route(true, { promise.resolve(null) }, { promise.reject("PRIVATE_ROUTE", it) })
    }
  }

  @ReactMethod
  fun play(clip: String, volume: Double, priv: Boolean, promise: Promise) {
    handler.post {
      stopInternal()
      if (clip.length > 180 || !Regex("[\\p{L}\\p{N}_-]+(?:\\.[\\p{L}\\p{N}_-]+)+").matches(clip)) {
        promise.reject("AUDIO_ASSET", "Ungültige Aufnahme."); return@post
      }
      val token = counter
      mediaPromise = promise
      playbackPrivate = priv
      route(priv, {
        if (counter != token || mediaPromise !== promise) return@route
        startMedia(priv, volume, token, { mp ->
          context.assets.openFd("alibi/game/alibi/voices/$clip.mp3").use { mp.setDataSource(it.fileDescriptor, it.startOffset, it.length) }
        })
      }, { if (mediaPromise === promise) { mediaPromise = null; promise.reject("PRIVATE_ROUTE", it) } })
    }
  }

  private fun startMedia(priv: Boolean, volume: Double, token: Long, source: (MediaPlayer) -> Unit, cleanup: (() -> Unit)? = null) {
    mediaCleanup = cleanup
    try {
      val mp = MediaPlayer()
      player = mp
      mp.setAudioAttributes(routing.attributes(priv))
      if (priv && Build.VERSION.SDK_INT >= 28 && !mp.setPreferredDevice(routing.receiver)) {
        finishMedia(mp, "Hörmuschel nicht verfügbar.", "PRIVATE_ROUTE"); return
      }
      source(mp)
      mp.setOnCompletionListener { finishMedia(mp) }
      mp.setOnErrorListener { _, _, _ -> finishMedia(mp, "Aufnahme konnte nicht abgespielt werden."); true }
      val gain = volume.toFloat().coerceIn(0f, 1f)
      mp.setVolume(if (priv) 0f else gain, if (priv) 0f else gain)
      mp.setOnPreparedListener {
        if (player !== mp || token != counter) return@setOnPreparedListener
        mp.start()
        if (priv && Build.VERSION.SDK_INT >= 28) {
          // Confirm actual routing while muted, for MP3 AND synthesized speech.
          // API 36 checks all outputs; no secret is sent to a fallback speaker.
          fun check(attempt: Int) {
            if (player !== mp || token != counter) return
            val devices = if (Build.VERSION.SDK_INT >= 36) mp.routedDevices else listOfNotNull(mp.routedDevice)
            if (devices.isNotEmpty() && devices.all { it.type == AudioDeviceInfo.TYPE_BUILTIN_EARPIECE }) {
              // Rewind the muted route probe so the first words are preserved.
              mp.pause()
              mp.setOnSeekCompleteListener { if (player === mp && token == counter) { mp.setVolume(gain, gain); mp.start() } }
              mp.seekTo(0)
            // The probe is muted, so waiting is safe. Right after start() the
            // output may still report the previous route (speaker) for a moment;
            // failing on that first reading silenced every secret on some devices.
            } else if (attempt < 40) handler.postDelayed({ check(attempt + 1) }, 25)
            else {
              Log.w("AlibiAudio", "secret stayed muted, routed to: " + devices.joinToString { "type=${it.type}" })
              finishMedia(mp, "Geheime Aufnahme bleibt stumm: Hörmuschel nicht aktiv.", "PRIVATE_ROUTE")
            }
          }
          mp.addOnRoutingChangedListener({ routed ->
            if (player === mp) {
              val devices = if (Build.VERSION.SDK_INT >= 36) routed.routedDevices else listOfNotNull(routed.routedDevice)
              if (devices.any { it.type != AudioDeviceInfo.TYPE_BUILTIN_EARPIECE }) {
                mp.setVolume(0f, 0f)
                finishMedia(mp, "Hörmuschel wurde getrennt.", "PRIVATE_ROUTE")
              }
            }
          }, handler)
          check(0)
        } else if (priv) mp.setVolume(gain, gain)
      }
      mp.prepareAsync()
    } catch (e: Exception) {
      player?.let { finishMedia(it, e.message ?: "Aufnahme fehlt.") }
        ?: run { mediaCleanup?.invoke(); mediaCleanup = null; val result = mediaPromise; mediaPromise = null; result?.reject("AUDIO_ASSET", e.message) }
    }
  }

  private fun finishMedia(mp: MediaPlayer, error: String? = null, code: String = "AUDIO_PLAYBACK") {
    if (player !== mp) return
    player = null
    mp.release()
    mediaCleanup?.invoke(); mediaCleanup = null
    val result = mediaPromise; mediaPromise = null
    if (error == null) result?.resolve(null) else result?.reject(code, error)
  }

  @ReactMethod
  fun speak(text: String, pitch: Double, rate: Double, volume: Double, priv: Boolean, promise: Promise) {
    handler.post {
      stopInternal()
      val id = "alibi-${++counter}"
      promises[id] = promise
      playbackPrivate = priv
      val play = {
        if (promises.containsKey(id)) {
          if (failed) promises.remove(id)?.reject("TTS_INIT", "Deutsche Sprachausgabe nicht verfügbar")
          else route(priv, {
            if (promises.containsKey(id)) {
              engine?.setPitch(pitch.toFloat().coerceIn(0.2f, 2f))
              engine?.setSpeechRate(rate.toFloat().coerceIn(0.2f, 2f))
              val attrs = engine?.setAudioAttributes(routing.attributes(priv))
              val params = Bundle().apply {
                putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, if (priv) 1f else volume.toFloat().coerceIn(0f, 1f))
                putInt(TextToSpeech.Engine.KEY_PARAM_STREAM, if (priv) AudioManager.STREAM_VOICE_CALL else AudioManager.STREAM_MUSIC)
              }
              // Private TTS is synthesized to an app-private temporary file,
              // then played through the same verified receiver as the MP3s.
              // This also covers TTS engines that ignore output attributes.
              val file = if (priv) File.createTempFile("alibi-speech-", ".wav", context.cacheDir) else null
              if (file != null) synthesized[id] = file to volume
              val result = if (attrs != TextToSpeech.SUCCESS) TextToSpeech.ERROR
                else if (file != null) engine?.synthesizeToFile(text, params, file, id)
                else engine?.speak(text, TextToSpeech.QUEUE_FLUSH, params, id)
              if (result != TextToSpeech.SUCCESS) { synthesized.remove(id)?.first?.delete(); promises.remove(id)?.reject("TTS_ERROR", "Sprachausgabe fehlgeschlagen") }
            }
          }, { promises.remove(id)?.reject("PRIVATE_ROUTE", it) })
        }
        Unit
      }
      if (ready || failed) play() else waiting.add(play)
    }
  }

  private fun stopInternal() {
    ++counter
    waiting.clear()
    engine?.stop()
    synthesized.values.forEach { it.first.delete() }; synthesized.clear()
    player?.let { finishMedia(it) }
    val result = mediaPromise; mediaPromise = null; result?.resolve(null)
    val pending = promises.values.toList(); promises.clear(); pending.forEach { it.resolve(null) }
    playbackPrivate = false
  }

  @ReactMethod fun stop() { handler.post { stopInternal() } }
  @ReactMethod fun release() { handler.post { stopInternal(); routingClose() } }
  override fun onHostPause() { handler.post { foreground = false; stopInternal(); routingClose() } }
  override fun onHostResume() { handler.post { foreground = true } }
  override fun onHostDestroy() { handler.post { foreground = false; stopInternal(); routingClose() } }
  override fun invalidate() {
    context.removeLifecycleEventListener(this)
    handler.post { stopInternal(); routingClose(); routing.dispose(); engine?.shutdown(); engine = null }
    super.invalidate()
  }
}
