package com.talea.app

import android.content.Context
import android.media.*
import android.os.Build
import android.os.Handler

/** Receiver selection applies only to communication audio, never WebView media.
 * Does not open the microphone or change the user's system volume. Main thread only. */
class AlibiAudioRouting(context: Context, private val handler: Handler, private val lost: () -> Unit) {
  private val audio = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
  private var savedMode: Int? = null
  private var savedSpeaker = false
  private var savedSco = false
  private var focus: AudioFocusRequest? = null
  private var epoch = 0
  private var opening = false
  private val pending = mutableListOf<Pair<() -> Unit, (String) -> Unit>>()
  var privateOutput = false
    private set
  var receiver: AudioDeviceInfo? = null
    private set
  private val focusListener = AudioManager.OnAudioFocusChangeListener { change ->
    if (change < 0) handler.post { if (privateOutput) lost() }
  }
  private val deviceListener = if (Build.VERSION.SDK_INT >= 31) AudioManager.OnCommunicationDeviceChangedListener { device ->
    if (privateOutput && !opening && device?.type != AudioDeviceInfo.TYPE_BUILTIN_EARPIECE) lost()
  } else null

  init {
    if (Build.VERSION.SDK_INT >= 31) audio.addOnCommunicationDeviceChangedListener({ job -> handler.post(job) }, deviceListener!!)
  }

  fun attributes(priv: Boolean): AudioAttributes = AudioAttributes.Builder()
    .setUsage(if (priv) AudioAttributes.USAGE_VOICE_COMMUNICATION else AudioAttributes.USAGE_MEDIA)
    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
    .apply { if (priv && Build.VERSION.SDK_INT >= 29) setAllowedCapturePolicy(AudioAttributes.ALLOW_CAPTURE_BY_NONE) }
    .build()

  @Suppress("DEPRECATION")
  fun open(ready: () -> Unit, failed: (String) -> Unit) {
    if (privateOutput && !opening && selected()) { ready(); return }
    pending.add(ready to failed)
    if (opening) return
    opening = true
    val token = ++epoch
    try {
      receiver = (if (Build.VERSION.SDK_INT >= 31) audio.availableCommunicationDevices
        else audio.getDevices(AudioManager.GET_DEVICES_OUTPUTS).toList())
        .firstOrNull { it.type == AudioDeviceInfo.TYPE_BUILTIN_EARPIECE }
      if (receiver == null) throw IllegalStateException("Dieses Gerät hat keine verfügbare Hörmuschel.")
      // Before API 28 MediaPlayer cannot verify its actual device. With an
      // external output connected, the legacy route could select a headset.
      if (Build.VERSION.SDK_INT < 28 && audio.getDevices(AudioManager.GET_DEVICES_OUTPUTS).any {
        it.type != AudioDeviceInfo.TYPE_BUILTIN_EARPIECE && it.type != AudioDeviceInfo.TYPE_BUILTIN_SPEAKER && it.type != AudioDeviceInfo.TYPE_BUILTIN_SPEAKER_SAFE
      }) throw IllegalStateException("Hörmuschel bei angeschlossenem Audio-Gerät nicht sicher verfügbar.")
      if (savedMode == null) { savedMode = audio.mode; savedSpeaker = audio.isSpeakerphoneOn; savedSco = audio.isBluetoothScoOn }
      val granted = if (Build.VERSION.SDK_INT >= 26) {
        focus = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
          .setAudioAttributes(attributes(true)).setOnAudioFocusChangeListener(focusListener, handler).build()
        audio.requestAudioFocus(focus!!)
      } else audio.requestAudioFocus(focusListener, AudioManager.STREAM_VOICE_CALL, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
      if (granted != AudioManager.AUDIOFOCUS_REQUEST_GRANTED) throw IllegalStateException("Hörmuschel ist gerade belegt.")
      audio.mode = AudioManager.MODE_IN_COMMUNICATION
      privateOutput = true
      if (Build.VERSION.SDK_INT >= 31) {
        if (!audio.setCommunicationDevice(receiver!!)) throw IllegalStateException("Hörmuschel konnte nicht aktiviert werden.")
      } else {
        audio.isSpeakerphoneOn = false
        audio.isBluetoothScoOn = false
      }
      // Wait for asynchronous device selection before starting a private voice.
      fun check(attempt: Int) {
        if (token != epoch) return
        if (selected()) {
          opening = false
          val jobs = pending.toList(); pending.clear()
          jobs.forEach { it.first() }
        } else if (attempt < 30) handler.postDelayed({ check(attempt + 1) }, 50)
        else fail("Hörmuschel konnte nicht sicher aktiviert werden.")
      }
      check(0)
    } catch (e: Exception) { fail(e.message ?: "Hörmuschel nicht verfügbar.") }
  }

  @Suppress("DEPRECATION")
  private fun selected() = privateOutput && audio.mode == AudioManager.MODE_IN_COMMUNICATION &&
    if (Build.VERSION.SDK_INT >= 31) audio.communicationDevice?.type == AudioDeviceInfo.TYPE_BUILTIN_EARPIECE
    else !audio.isSpeakerphoneOn && !audio.isBluetoothScoOn

  private fun fail(message: String) {
    val jobs = pending.toList(); pending.clear()
    close()
    jobs.forEach { it.second(message) }
  }

  @Suppress("DEPRECATION")
  fun close() {
    ++epoch
    opening = false
    privateOutput = false
    receiver = null
    val jobs = pending.toList(); pending.clear()
    if (savedMode != null) {
      if (Build.VERSION.SDK_INT >= 31) audio.clearCommunicationDevice()
      else { audio.isSpeakerphoneOn = savedSpeaker; audio.isBluetoothScoOn = savedSco }
      audio.mode = savedMode!!
      savedMode = null
    }
    if (Build.VERSION.SDK_INT >= 26) focus?.let { audio.abandonAudioFocusRequest(it) }
    else audio.abandonAudioFocus(focusListener)
    focus = null
    jobs.forEach { it.second("Audioausgabe unterbrochen.") }
  }

  fun dispose() {
    close()
    if (Build.VERSION.SDK_INT >= 31) audio.removeOnCommunicationDeviceChangedListener(deviceListener!!)
  }
}
