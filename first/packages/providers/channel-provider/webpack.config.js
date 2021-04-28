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
  node: {
    child_process: "empty",
    fs: "empty",
    net: "empty",
  },
};
