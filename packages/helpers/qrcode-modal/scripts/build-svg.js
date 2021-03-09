const svgUrlLoader = require("svg-url-loader");

const buildAsset = require("./build-asset");

buildAsset({
  assetFile: "logo.svg",
  loader: (input) => svgUrlLoader(input).replace(`module.exports = "`, "").replace(`"`, ""),
  targetFile: "logo.ts",
  targetVar: "WALLETCONNECT_LOGO_SVG_URL",
});

buildAsset({
  assetFile: "caret.svg",
  loader: (input) => svgUrlLoader(input).replace(`module.exports = "`, "").replace(`"`, ""),
  targetFile: "caret.ts",
  targetVar: "CARET_SVG_URL",
});
