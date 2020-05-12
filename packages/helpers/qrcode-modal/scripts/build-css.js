const path = require("path");
const { readFile, writeFile } = require("../../../../scripts/shared");

const PKG_DIR = path.join(__dirname, "../");

const ASSETS_DIR = path.join(PKG_DIR, "src", "browser", "assets");

const CSS_FILE_NAME = "style.css";
const CSS_FILE_PATH = path.join(ASSETS_DIR, CSS_FILE_NAME);

const TS_FILE_NAME = "style.ts";
const TS_FILE_PATH = path.join(ASSETS_DIR, TS_FILE_NAME);

const TARGET_VARIABLE = "WALLETCONNECT_STYLE_SHEET";

async function buildCSS() {
  const css = await readFile(CSS_FILE_PATH);
  await writeFile(TS_FILE_PATH, "export const " + TARGET_VARIABLE + " = `" + css + "`;");
}

buildCSS();
