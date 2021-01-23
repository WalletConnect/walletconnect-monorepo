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

  onConnect({ accounts, chainId: provider.chainId });
}

function onSubscribe() {
  if (!provider) {
    throw new Error(`provider hasn't been created yet`);
  }

  provider.on("accountsChanged", accounts => {
    updateView({ accounts });
  });

  provider.on("chainChanged", chainId => {
    updateView({ chainId });
  });

  provider.on("close", () => {
    provider = null;
    onDisconnect();
  });
}

function signMessage() {
  if (!provider) {
    throw new Error(`provider hasn't been created yet`);
  }

  const address = provider.accounts[0];
  const msg = "Test message from WalletConnect example";

  // send eth_sign request
  provider
    .send({ method: "eth_sign", params: [address, msg] })
    .then(result => {
      // Returns message signature
      console.log(result); // eslint-disable-line
    })
    .catch(error => {
      // Error returned when rejected
      console.error(error); // eslint-disable-line
    });
}
