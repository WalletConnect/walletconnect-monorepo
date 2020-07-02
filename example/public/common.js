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

async function updateView({ accounts, chainId }) {
  const containerEl = document.getElementById("page-actions");
  const pTags = containerEl.getElementsByTagName("p");
  if (pTags.length === 1) {
    const textEl = containerEl.getElementsByTagName("p")[0];
    textEl.innerHTML = "Connected!";

    const accountEl = document.createElement("p");
    if (accounts) {
      accountEl.innerHTML = `Account: ${accounts[0]}`;
    }
    insertAfter(accountEl, textEl);

    const chainEl = document.createElement("p");
    if (chainId) {
      const chainData = await getChainData(chainId);
      chainEl.innerHTML = `Chain: ${chainData.name}`;
    }
    insertAfter(chainEl, accountEl);
  } else {
    if (accounts) {
      const accountEl = containerEl.getElementsByTagName("p")[1];
      accountEl.innerHTML = `Account: ${accounts[0]}`;
    }

    if (chainId) {
      const chainData = await getChainData(chainId);

      const chainEl = containerEl.getElementsByTagName("p")[2];
      chainEl.innerHTML = `Chain: ${chainData.name}`;
    }
  }
}

function updateAction(title, action) {
  const containerEl = document.getElementById("page-actions");
  const buttonEl = containerEl.getElementsByTagName("button")[0];
  buttonEl.innerText = title;
  buttonEl.onclick = action;
}

function onConnect(
  { accounts, chainId },
  action = { label: "Sign Message", callback: signPersonalMessage },
) {
  updateView({ accounts, chainId });
  updateAction(action.label, action.callback);
}

function onDisconnect() {
  const containerEl = document.getElementById("page-actions");
  const pTags = containerEl.getElementsByTagName("p");

  const textEl = containerEl.getElementsByTagName("p")[0];
  textEl.innerHTML = "Disconnected!";

  if (pTags.length > 1) {
    const accountEl = containerEl.getElementsByTagName("p")[1];
    accountEl.remove();

    const chainEl = containerEl.getElementsByTagName("p")[1];
    chainEl.remove();
  }

  updateAction("Connect", onInit);
}
