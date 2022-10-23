const path = require("path");
const nodeExternals = require("webpack-node-externals");
const NODE_ENV = "development";

const client = {
  entry: path.join(__dirname, "src", "browser_sdk", "index.ts"),
  target: "web",
  mode: NODE_ENV,
  devtool: "source-map",
  watch: false,
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "client.js",
    library: {
      type: "umd",
    },
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
  },
  externals: {},
  optimization: {
    minimize: false,
  },
};

const server = {
  entry: path.join(__dirname, "src", "server", "index.ts"),
  mode: NODE_ENV,
  target: "node",
  externals: [nodeExternals()],
  watch: false,
  devtool: "source-map",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "server.js",
    library: {
      type: "umd",
    },
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: "ts-loader",
      },
    ],
  },
};

module.exports = [server, client];
