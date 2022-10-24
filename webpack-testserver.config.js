const path = require("path");
const nodeExternals = require("webpack-node-externals");
const NODE_ENV = "development";

module.exports = [{
  entry: path.join(__dirname, "specs", "server.ts"),
  mode: NODE_ENV,
  target: "node",
  externals: [nodeExternals()],
  watch: false,
  devtool: "source-map",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "testserver.js",
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
}];
