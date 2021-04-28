const svgUrlLoader = require("svg-url-loader");

const buildAsset = require("./build-asset");

buildAsset({
  assetFile: "logo.svg",
  targetFile: "logo.ts",
  targetVar: "WALLETCONNECT_LOGO_SVG_URL",
  loader: input =>
    svgUrlLoader(input)
      .replace(`module.exports = "`, "")
      .replace(`"`, ""),
});


buildAsset({
  assetFile: "caret.svg",
  targetFile: "caret.ts",
  targetVar: "CARET_SVG_URL",
  loader: input =>
    svgUrlLoader(input)
      .replace(`module.exports = "`, "")
      .replace(`"`, ""),
});
