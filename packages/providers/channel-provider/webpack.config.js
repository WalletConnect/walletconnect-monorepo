const path = require("path");

module.exports = {
  mode: "production",
  entry: {
    index: path.resolve(__dirname, "dist", "cjs", "index.js"),
  },
  output: {
    path: path.resolve(__dirname, "dist", "umd"),
    filename: "[name].min.js",
    libraryTarget: "umd",
    library: "WalletConnectChannelProvider",
    umdNamedDefine: true,
    globalObject: "this",
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js"],
  },
  devtool: "source-map",
  optimization: {
    minimize: true,
  },
  node: {
    child_process: "empty",
    fs: "empty",
    net: "empty",
  },
  module: {
    rules: [{ test: /\.tsx?$/, loader: "ts-loader" }],
  },
};
