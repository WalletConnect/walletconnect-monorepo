import RNWalletConnect from "../src";

describe("RNWalletConnect", () => {
  it("instantiate successfully", () => {
    const provider = new RNWalletConnect(
      {
        bridge: "https://bridge.walletconnect.org",
      },
      {
        clientMeta: {
          name: "NodeWalletConnect",
          description: "WalletConnect in NodeJS",
          url: "#",
          icons: ["https://walletconnect.org/walletconnect-logo.png"],
        },
      },
    );
    expect(provider).toBeTruthy();
  });
});
