import { WalletConnect } from "@walletconnect/browser";

// Create a walletConnector
const walletConnector = new WalletConnect({
  bridge: "https://bridge.walletconnect.org",
});

// Check if connection is already established
if (!walletConnector.connected) {
  // create new session
  walletConnector.createSession().then(() => {
    // get uri for QR Code modal
    const uri = walletConnector.uri;
    // display QR Code modal
    console.log("Got URI", uri);
  });
}

// Subscribe to connection events
walletConnector.on("connect", (error: any, payload: any) => {
  if (error) {
    throw error;
  }
  // Get provided accounts and chainId
  const { accounts, chainId } = payload.params[0];
});

walletConnector.on("session_update", (error: any, payload: any) => {
  if (error) {
    throw error;
  }

  // Get updated accounts and chainId
  const { accounts, chainId } = payload.params[0];
});

walletConnector.on("disconnect", (error: any, payload: any) => {
  if (error) {
    throw error;
  }

  // Delete walletConnector
});


