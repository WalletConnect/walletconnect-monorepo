const path = require("path");
const { readFile, writeFile } = require("../../../ops/js/shared");

const PKG_DIR = path.join(__dirname, "../");

const ASSETS_DIR = path.join(PKG_DIR, "src", "browser", "assets");

async function buildAsset({ assetDir, assetFile, targetFile, targetVar, loader }) {
  const assetFilePath = path.join(assetDir || ASSETS_DIR, assetFile);
  const input = await readFile(assetFilePath);
  const targetFilePath = path.join(ASSETS_DIR, targetFile);
  const output = loader ? await loader(input) : input;
  const value = typeof output === "string" ? "`" + output + "`" : JSON.stringify(output, null, 2);
  const content = "export const " + targetVar + " = " + value + ";";
  await writeFile(targetFilePath, content);
}

module.exports = buildAsset;
