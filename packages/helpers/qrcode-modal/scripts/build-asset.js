const path = require("path");
const { readFile, writeFile } = require("../../../../scripts/shared");

const PKG_DIR = path.join(__dirname, "../");

const ASSETS_DIR = path.join(PKG_DIR, "src", "browser", "assets");

async function buildAsset({ assetFile, targetFile, targetVar, loader }) {
  const assetFilePath = path.join(ASSETS_DIR, assetFile);
  const input = await readFile(assetFilePath);
  const targetFilePath = path.join(ASSETS_DIR, targetFile);
  const output = loader ? loader(input) : input;
  await writeFile(targetFilePath, "export const " + targetVar + " = `" + output + "`;");
}

module.exports = buildAsset;
