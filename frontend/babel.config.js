module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // WatermelonDB requires legacy decorator support
      ['@babel/plugin-proposal-decorators', { legacy: true }],
    ],
  };
};
