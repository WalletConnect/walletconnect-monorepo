"use strict";

// updates title to display package version
window.updateTitle();

const WalletConnect = window.WalletConnect.default;
const WalletConnectQRCodeModal = window.WalletConnectQRCodeModal.default;

const DEFAULT_BRIDGE = "https://bridge.walletconnect.org";

let connector = null;

function onInit() {
  // Create a connector
  connector = new WalletConnect({
    bridge: DEFAULT_BRIDGE, // Required
  });

  // Check if connection is already established
  if (!connector.connected) {
    // create new session
    connector.createSession().then(() => {
      // get uri for QR Code modal
      const uri = connector.uri;
      // display QR Code modal
      WalletConnectQRCodeModal.open(uri, () => {
        console.log("QR Code Modal closed"); // eslint-disable-line
      });
    });
  } else {
    const { accounts, chainId } = connector;
    updateSessionDetails({ accounts, chainId });
  }

  onSubscribe();
}

function onSubscribe() {
  if (!connector) {
    throw new Error(`connector hasn't been created yet`);
  }
  // Subscribe to connection events
  connector.on("connect", (error, payload) => {
    if (error) {
      throw error;
    }

    // Close QR Code Modal
    WalletConnectQRCodeModal.close();

    // Get provided accounts and chainId
    const { accounts, chainId } = payload.params[0];

    updateSessionDetails({ accounts, chainId });
  });

  connector.on("session_update", (error, payload) => {
    if (error) {
      throw error;
    }

    // Get updated accounts and chainId
    const { accounts, chainId } = payload.params[0];

    updateSessionDetails({ accounts, chainId });
  });

  connector.on("disconnect", (error, payload) => {
    if (error) {
      throw error;
    }

    // Delete connector
    connector = null;

    onDisconnect();
  });
}

async function onDisconnect() {
  const containerEl = document.getElementById("page-actions");
  const pTags = containerEl.getElementsByTagName("p");

  const textEl = containerEl.getElementsByTagName("p")[0];
  textEl.innerHTML = "Disconnected!";

  const buttonEl = containerEl.getElementsByTagName("button")[0];
  buttonEl.innerText = "WalletConnect";
  buttonEl.onclick = onInit;
  if (pTags.length > 1) {
    const accountEl = containerEl.getElementsByTagName("p")[1];
    accountEl.remove();

    const chainEl = containerEl.getElementsByTagName("p")[1];
    chainEl.remove();
  }
}

function sendTestTransaction() {
  if (!connector) {
    throw new Error(`connector hasn't been created yet`);
  }

  // Draft transaction
  const tx = {
    from: connector.accounts[0],
    to: connector.accounts[0],
    data: "0x", // Required
  };

  // Send transaction
  connector
    .sendTransaction(tx)
    .then(result => {
      // Returns transaction id (hash)
      console.log(result); // eslint-disable-line
    })
    .catch(error => {
      // Error returned when rejected
      console.error(error); // eslint-disable-line
    });
}

async function updateSessionDetails({ accounts, chainId }) {
  const containerEl = document.getElementById("page-actions");
  const pTags = containerEl.getElementsByTagName("p");
  if (pTags.length === 1) {
    const textEl = containerEl.getElementsByTagName("p")[0];
    textEl.innerHTML = "Connected!";

    const accountEl = document.createElement("p");
    accountEl.innerHTML = `Account: ${accounts[0]}`;
    window.insertAfter(accountEl, textEl);

    const chainData = await window.getChainData(chainId);

    const chainEl = document.createElement("p");
    chainEl.innerHTML = `Chain: ${chainData.name}`;
    window.insertAfter(chainEl, accountEl);

    const buttonEl = containerEl.getElementsByTagName("button")[0];
    buttonEl.innerText = "Send Transaction";
    buttonEl.onclick = sendTestTransaction;
  } else {
    const accountEl = containerEl.getElementsByTagName("p")[1];
    accountEl.innerHTML = `Account: ${accounts[0]}`;

    const chainData = await window.getChainData(chainId);

    const chainEl = containerEl.getElementsByTagName("p")[2];
    chainEl.innerHTML = `Chain: ${chainData.name}`;
  }
}
