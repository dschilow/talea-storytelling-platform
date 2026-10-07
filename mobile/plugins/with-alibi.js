const { withAppBuildGradle, withMainApplication, withAndroidManifest } = require('@expo/config-plugins');

/** Keep the local game packer and receiver-only native audio through prebuild. */
module.exports = function withAlibi(config) {
  config = withAppBuildGradle(config, mod => {
    const line = 'apply from: new File(rootDir.getAbsoluteFile().getParentFile(), "plugins/alibi/bundle.gradle")';
    if (!mod.modResults.contents.includes('plugins/alibi/bundle.gradle')) mod.modResults.contents += `\n${line}\n`;
    return mod;
  });
  config = withMainApplication(config, mod => {
    if (!mod.modResults.contents.includes('add(AlibiSpeechPackage())')) {
      mod.modResults.contents = mod.modResults.contents.replace('PackageList(this).packages.apply {', 'PackageList(this).packages.apply {\n              add(AlibiSpeechPackage())');
    }
    return mod;
  });
  return withAndroidManifest(config, mod => {
    const manifest = mod.modResults.manifest;
    manifest['uses-permission'] ??= [];
    if (!manifest['uses-permission'].some(p => p.$?.['android:name'] === 'android.permission.MODIFY_AUDIO_SETTINGS')) {
      manifest['uses-permission'].push({ $: { 'android:name': 'android.permission.MODIFY_AUDIO_SETTINGS' } });
    }
    manifest.queries ??= [];
    if (!manifest.queries.some(q => q.intent?.some(i => i.action?.some(a => a.$?.['android:name'] === 'android.intent.action.TTS_SERVICE')))) {
      manifest.queries.push({ intent: [{ action: [{ $: { 'android:name': 'android.intent.action.TTS_SERVICE' } }] }] });
    }
    return mod;
  });
};
