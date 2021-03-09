const buildAsset = require("./build-asset");

buildAsset({
  assetFile: "style.css",
  loader: (input) => input.toString(),
  targetFile: "style.ts",
  targetVar: "WALLETCONNECT_STYLE_SHEET",
});
