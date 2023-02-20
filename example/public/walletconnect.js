"use strict";

// updates title to display package version
updateTitle();

const WalletConnect = window.WalletConnect.default;
const WalletConnectQRCodeModal = window.WalletConnectQRCodeModal.default;

// const DEFAULT_BRIDGE = "https://bridge.walletconnect.org";

let connector = null;

function onInit() {
  // Create a connector

  // const qrcodeModalOptions =   {
  //   mobileLinks: ["D'CENT Wallet"], 
  //   desktopLinks: ["D'CENT Wallet"],

  // };
  const clientMeta={
    description: "Connect with WalletConnect",
    url: "https://walletconnect.org",
    icons: ["https://walletconnect.org/walletconnect-logo.png"],
    name: "WalletConnect",
  };
  

  connector = new WalletConnect({
    // bridge: DEFAULT_BRIDGE, // Required
    qrcodeModal: WalletConnectQRCodeModal,
    // qrcodeModalOptions,
    clientMeta,
    
  });
  
  // Check if connection is already established
  if (!connector.connected) {
    // create new session
    connector.createSession();
    // console.log("connectore session",connector);
  } else {
    const { accounts, chainId } = connector;
    // console.log("connector",connector);
    onConnect({ accounts, chainId });
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
    // console.log(payload);

    // Get provided accounts and chainId
    const { accounts, chainId } = payload.params[0];

    onConnect({ accounts, chainId });
  });

  connector.on("session_update", (error, payload) => {
    if (error) {
      throw error;
    }
    // console.log("session update payload",payload);
    // console.log("seession update connector",connector);

    // Get updated accounts and chainId
    const { accounts, chainId } = payload.params[0];

    updateView({ accounts, chainId });
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

function signPersonalMessage() {
  if (!connector) {
    throw new Error(`connector hasn't been created yet`);
  }

  const msg = "Test message from WalletConnect example";

  // send personal_sign request
  connector
    .signPersonalMessage([msg, connector.accounts[0]])
    .then(result => {
      // Returns message signature
      console.log(result); // eslint-disable-line
    })
    .catch(error => {
      // Error returned when rejected
      console.error(error); // eslint-disable-line
    });
}