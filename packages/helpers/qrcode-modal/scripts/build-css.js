const buildAsset = require("./build-asset");

buildAsset({
  assetFile: "style.css",
  targetFile: "style.ts",
  targetVar: "WALLETCONNECT_STYLE_SHEET",
});
