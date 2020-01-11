const {
  FILE_NAME,
  FILE_PATH,
  isFile,
  isJson,
  formatJson,
  writeFile
} = require("./shared");

function parseEntry(entry) {
  return {
    name: entry.name || "",
    color: entry.color || "",
    universalLink: entry.universalLink || "",
    deepLink: entry.deepLink || "",
    chromeIntent: entry.chromeIntent || ""
  };
}

async function parse() {
  if ((await isFile(FILE_PATH)) && isJson(FILE_NAME)) {
    let json = require(FILE_PATH);

    let newJson = json.map(parseEntry);

    const formattedJson = formatJson(newJson);

    await writeFile(FILE_PATH, formattedJson);
  } else {
    throw new Error(`Invalid - Failed to read file: ${FILE_NAME}`);
  }
}

parse();
