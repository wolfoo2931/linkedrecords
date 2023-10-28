const path = require("path");
const nodeExternals = require("webpack-node-externals");
const NODE_ENV = "development";

const client = {
  entry: path.join(__dirname, 'client.ts'),
  target: 'web',
  mode: 'production',
  watch: false,
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
