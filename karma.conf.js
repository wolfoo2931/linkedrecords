module.exports = function (config) {
  config.set({
    frameworks: ['mocha', 'webpack'],

    plugins: [
      'karma-mocha',
      'karma-webpack',
      'karma-spec-reporter',
      'karma-chrome-launcher'
    ],

    files: ['specs/**/*.spec.ts'],

    preprocessors: {
      'specs/**/*.spec.ts': ['webpack'],
    },

    browsers: ['ChromeHeadless'],

    reporters: ['spec'],

    singleRun: true,

    webpack: {
      resolve: {
        extensions: ['.ts', '.js']
      },
      module: {
        rules: [
          {
            test: /\.ts$/,
            use: 'ts-loader',
          },
        ],
      },
    },
  });
};
