let supportedChains = null;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function getChainData(chainId) {
  if (!supportedChains) {
    supportedChains = await getJsonFile("./chains.json");
  }

  const chainData = supportedChains.filter(chain => chain.chain_id === chainId)[0];

  if (!chainData) {
    throw new Error("ChainId missing or not supported");
  }

  return chainData;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function getJsonFile(path) {
  const res = await fetch(path);
  const json = await res.json();
  return json;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function updateTitle() {
  const { version } = await getJsonFile("../../lerna.json");
  const title = document.getElementById("page-title");
  title.innerHTML = title.innerHTML.replace(/\sv(\w.)+.\w+/gi, "") + ` v${version}`;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function insertAfter(newNode, referenceNode) {
  referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
}
