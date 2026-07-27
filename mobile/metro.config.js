// Learn more: https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The generated Encore client ships as .ts; the locale bundles as .json. Both are
// already covered by the defaults — we only add the module formats some
// transitive deps publish.
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs', 'cjs'];

module.exports = config;
