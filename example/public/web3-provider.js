"use strict";

// updates title to display package version
updateTitle();

const WalletConnectProvider = window.WalletConnectProvider.default;

let provider = null;

async function onInit() {
  // Create a provider
  provider = new WalletConnectProvider({
    rpc: {
      1: "https://api.mycryptoapi.com/eth",
    },
  });

  onSubscribe();

  const accounts = await provider.enable();

  updateSessionDetails({ accounts, chainId: provider.chainId });
}

function onSubscribe() {
  if (!provider) {
    throw new Error(`provider hasn't been created yet`);
  }

  provider.on("accountsChanged", accounts => {
    updateSessionDetails({ accounts });
  });

  provider.on("chainChanged", chainId => {
    updateSessionDetails({ chainId });
  });

  provider.on("close", () => {
    provider = null;
    onDisconnect();
  });
}

function signPersonalMessage() {
  if (!provider) {
    throw new Error(`provider hasn't been created yet`);
  }

  const msg = "Test message from WalletConnect example";

  // send personal_sign request
  provider
    .send({ method: "personal_sign", params: [msg, provider.accounts[0]] })
    .then(result => {
      // Returns message signature
      console.log(result); // eslint-disable-line
    })
    .catch(error => {
      // Error returned when rejected
      console.error(error); // eslint-disable-line
    });
}
