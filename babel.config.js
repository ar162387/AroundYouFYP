module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      'module:@react-native/babel-preset',
      ['nativewind/babel', { jsxImportSource: 'nativewind' }],
    ],
    plugins: ['react-native-reanimated/plugin'],
  };
};
