import NodeWalletConnect from "../src";

const TEST_BRIDGE_URL = "https://bridge.walletconnect.org";

const TEST_SESSION_PARAMS = {
  accounts: ["0x1d85568eEAbad713fBB5293B45ea066e552A90De"],
  chainId: 1,
};

const TEST_CLIENT_META = {
  name: "Test Environment",
  description: "WalletConnect Monorepo Test Environment",
  url: "#",
  icons: ["https://walletconnect.org/walletconnect-logo.png"],
};

describe("NodeWalletConnect", () => {
  it("instantiate successfully", () => {
    const connector = new NodeWalletConnect(
      {
        bridge: TEST_BRIDGE_URL,
      },
      {
        clientMeta: TEST_CLIENT_META,
      },
    );
    expect(connector).toBeTruthy();
    expect(connector.bridge).toEqual(TEST_BRIDGE_URL);
  });

  it("connect two clients", async () => {
    const connectorA = new NodeWalletConnect(
      {
        bridge: TEST_BRIDGE_URL,
      },
      {
        clientMeta: TEST_CLIENT_META,
      },
    );

    await Promise.all([
      new Promise((resolve, reject) => {
        connectorA.on("connect", error => {
          if (error) {
            reject(error);
          }

          expect(connectorA.connected).toBeTruthy();
          expect(connectorA.accounts).toEqual(TEST_SESSION_PARAMS.accounts);
          expect(connectorA.chainId).toEqual(TEST_SESSION_PARAMS.chainId);
          resolve();
        });
      }),
      new Promise((resolve, reject) => {
        connectorA.on("display_uri", (error, payload) => {
          if (error) {
            reject(error);
          }

          const uri = payload.params[0];

          const connectorB = new NodeWalletConnect(
            { uri },
            {
              clientMeta: TEST_CLIENT_META,
            },
          );

          // Subscribe to session requests
          connectorB.on("session_request", error => {
            if (error) {
              reject(error);
            }

            connectorB.approveSession(TEST_SESSION_PARAMS);

            expect(connectorB.connected).toBeTruthy();
            expect(connectorB.accounts).toEqual(TEST_SESSION_PARAMS.accounts);
            expect(connectorB.chainId).toEqual(TEST_SESSION_PARAMS.chainId);
            resolve();
          });
        });
      }),
      new Promise(resolve => {
        connectorA.createSession();
        resolve();
      }),
    ]);
  });
});
