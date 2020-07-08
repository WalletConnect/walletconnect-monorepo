"use strict";

// updates title to display package version
updateTitle();

const WalletConnectSDK = window.WalletConnectSDK.default;

let wc = null;
let provider = null;

async function onInit() {
  console.log("onInit");
  // Create a new SDK
  wc = new WalletConnectSDK();
  console.log("wc", wc);
  // Start connector
  await wc.connect();

  provider = await wc.getWeb3Provider({
    rpc: {
      1: "https://api.mycryptoapi.com/eth",
    },
  });
  console.log("provider", provider);
  onSubscribe();

  const accounts = await provider.enable();
  console.log("accounts", accounts);

  onConnect({ accounts, chainId: provider.chainId });

  const starkwareProvider = await wc.getStarkwareProvider({
    contractAddress: "0xC5273AbFb36550090095B1EDec019216AD21BE6c",
  });

  console.log("starkwareProvider", starkwareProvider);

  const starkPublicKey = await starkwareProvider.enable();
  console.log("starkPublicKey", starkPublicKey);
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
