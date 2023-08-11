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

    client: {
      mocha: {
        timeout: 20000,
      }
    },

    logLevel: config.DEBUG,

    browsers: ['Chrome_with_third_party_cookies'],

    customLaunchers: {
      Chrome_with_third_party_cookies: {
        base: 'ChromeHeadless',
        flags: ['--disable-web-security']
      }
    },

    reporters: ['spec'],

    singleRun: true,

    webpack: {
      resolve: {
        extensions: ['.ts', '.js']
      },
      module: {
        rules: [
          {
            test: /\.tsx?$/,
            use: {
              loader: "ts-loader",
              options: {
                transpileOnly: true
              },
            },
            exclude: (e) => {
              let file = e.replace(__dirname, '.');

              return file.match(/node_modules/)
            }
          },
        ],
      },
    },
  });
};
