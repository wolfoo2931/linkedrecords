const path = require("path");
const webpack = require("webpack");
const nodeExternals = require("webpack-node-externals");
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const NODE_ENV = "development";

const client = {
  entry: path.join(__dirname, 'client.ts'),
  target: 'web',
  mode: 'production',
  watch: false,
  devtool: 'source-map',
  output: {
    filename: 'client.packaged.js',
    path: __dirname
  },
  optimization: {
    minimize: false
  },
  performance: {
    hints: false,
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
      },
    ],
  },
  plugins: [
    new webpack.DefinePlugin({
      TESTAPP_AUTH_MODE: JSON.stringify(process.env.TEST_AUTH_MODE || 'confidential'),
      AUTH_TOKEN_AUDIENCE: JSON.stringify(process.env.AUTH_TOKEN_AUDIENCE || null),
      AUTH_ISSUER_BASE_URL: JSON.stringify(process.env.AUTH_ISSUER_BASE_URL || null),
      AUTH_CLIENT_ID: JSON.stringify(process.env.AUTH_CLIENT_ID || null),
    }),
  ],
}

const server = {
  entry: path.join(__dirname, 'server.ts'),
  mode: NODE_ENV,
  target: 'node',
  externals: [nodeExternals()],
  watch: false,
  devtool: 'source-map',
  optimization: {
    minimize: false
  },
  performance: {
    hints: false,
  },
  output: {
    path: __dirname,
    filename: 'testserver.js',
    library: {
      type: 'umd',
    },
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
      },
    ],
  },
}


module.exports = [ server, client ];
