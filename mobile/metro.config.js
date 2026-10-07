// Learn more: https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const config = getDefaultConfig(__dirname);

// The Android character cache uses the game's canonical data. Metro must index
// this shared source directory, which lives outside the mobile project root.
config.watchFolders = [...config.watchFolders, path.resolve(__dirname, '../frontend/screens/Game/alibi')];

// The generated Encore client ships as .ts; the locale bundles as .json. Both are
// already covered by the defaults — we only add the module formats some
// transitive deps publish.
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs', 'cjs'];

module.exports = config;
