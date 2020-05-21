const path = require("path");
const svgUrlLoader = require("svg-url-loader");
const { readFile, writeFile } = require("../../../../scripts/shared");

const PKG_DIR = path.join(__dirname, "../");

const ASSETS_DIR = path.join(PKG_DIR, "src", "browser", "assets");

const SVG_FILE_NAME = "logo.svg";
const SVG_FILE_PATH = path.join(ASSETS_DIR, SVG_FILE_NAME);

const TS_FILE_NAME = "logo.ts";
const TS_FILE_PATH = path.join(ASSETS_DIR, TS_FILE_NAME);

const TARGET_VARIABLE = "WALLETCONNECT_LOGO_SVG_URL";

async function buildSVG() {
  const svg = await readFile(SVG_FILE_PATH);
  const url = svgUrlLoader(svg)
    .replace(`module.exports = "`, "")
    .replace(`"`, "");
  console.log("url", url); // eslint-disable-line
  await writeFile(TS_FILE_PATH, "export const " + TARGET_VARIABLE + " = `" + url + "`;");
}

buildSVG();
