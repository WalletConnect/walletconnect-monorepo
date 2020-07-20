const path = require("path");

const buildAsset = require("./build-asset");

const { readFile } = require("../../../../scripts/shared");

const PKG_DIR = path.join(__dirname, "../");
const REGISTRY_DIR = path.join(PKG_DIR, "node_modules", "@walletconnect", "mobile-registry");

const registryLoader = input => {
  const array = JSON.parse(input.toString("utf8"));
  return Promise.all(
    array.map(async entry => {
      const buffer = await readFile(path.join(REGISTRY_DIR, entry.logo));
      const logo = `data:image/${path.extname(entry.logo)};base64,${buffer.toString("base64")}`;
      return { ...entry, logo };
    }),
  );
};

buildAsset({
  assetDir: REGISTRY_DIR,
  assetFile: "registry.json",
  targetFile: "registry.ts",
  targetVar: "MOBILE_REGISTRY",
  loader: registryLoader,
});
