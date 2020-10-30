const path = require("path");
const { isFile, isJson, formatJson, writeFile } = require("../../../../scripts/shared");

const PKG_DIR = path.join(__dirname, "../");
const FILE_NAME = "registry.json";
const FILE_PATH = path.join(PKG_DIR, FILE_NAME);

function parseEntry(entry) {
  return {
    name: entry.name || "",
    shortName: entry.shortName || "",
    color: entry.color || "",
    logo: entry.logo || "",
    universalLink: entry.universalLink || "",
    deepLink: entry.deepLink || "",
  };
}

async function parse() {
  if ((await isFile(FILE_PATH)) && isJson(FILE_NAME)) {
    const json = require(FILE_PATH);

    const newJson = json.map(parseEntry);

    const formattedJson = formatJson(newJson);

    await writeFile(FILE_PATH, formattedJson);
  } else {
    throw new Error(`Invalid - Failed to read file: ${FILE_NAME}`);
  }
}

parse();
