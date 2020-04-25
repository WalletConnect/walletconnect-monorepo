import NodeWalletConnect from "../src";

describe("NodeWalletConnect", () => {
  it("instantiate successfully", () => {
    const provider = new NodeWalletConnect(
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
