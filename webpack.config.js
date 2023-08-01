const path = require("path");
const nodeExternals = require("webpack-node-externals");
const NODE_ENV = "development";

const client = {
  entry: path.join(__dirname, "src", "browser_sdk", "index.ts"),
  context: path.resolve(__dirname, "src", "browser_sdk"),
  target: "web",
  mode: NODE_ENV,
  devtool: "source-map",
  watch: false,
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "browser_sdk.js",
    library: {
      type: "umd",
    },
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: "ts-loader",
          options: {
            transpileOnly: false,
          },
        },
        exclude: (e) => {
          let file = e.replace(__dirname, '.');

          return file.match(/node_modules/)
        }
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
  },
  optimization: {
    minimize: false,
  },
};

const server = {
  entry: path.join(__dirname, "src", "server", "index.ts"),
  context: path.resolve(__dirname, "src", "server"),
  mode: NODE_ENV,
  target: "node",
  externals: [nodeExternals(), 'pg-native'],
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
};

module.exports = [server, client];
