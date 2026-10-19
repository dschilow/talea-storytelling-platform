const { withAppBuildGradle, withMainApplication } = require('@expo/config-plugins');

module.exports = function withWebApp(config) {
  config = withAppBuildGradle(config, mod => {
    const line = 'apply from: new File(rootDir.getAbsoluteFile().getParentFile(), "plugins/web/bundle.gradle")';
    if (!mod.modResults.contents.includes('plugins/web/bundle.gradle')) mod.modResults.contents += `\n${line}\n`;
    return mod;
  });
  return withMainApplication(config, mod => {
    if (!mod.modResults.contents.includes('add(TaleaWebViewPackage())')) {
      mod.modResults.contents = mod.modResults.contents.replace('PackageList(this).packages.apply {', `PackageList(this).packages.apply {
              removeAll { it is com.reactnativecommunity.webview.RNCWebViewPackage }
              add(TaleaWebViewPackage())`);
    }
    return mod;
  });
};
