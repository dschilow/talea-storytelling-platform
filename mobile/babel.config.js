module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo resolves the `@/*` alias from tsconfig.json automatically
    // (Expo CLI path-alias support), so no module-resolver plugin is needed.
    presets: ['babel-preset-expo'],
    plugins: [
      // Must stay last — Reanimated 4 requires the worklets plugin at the end.
      'react-native-worklets/plugin',
    ],
  };
};
