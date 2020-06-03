import IsomorphicClient from "../src";

const TEST_BRIDGE_URL = "https://bridge.walletconnect.org";

const TEST_SESSION_PARAMS = {
  accounts: ["0x1d85568eeabad713fbb5293b45ea066e552a90de"],
  chainId: 1,
};

describe("IsomorphicClient", () => {
  it("instantiate successfully", () => {
    const connector = new IsomorphicClient({
      bridge: TEST_BRIDGE_URL,
    });
    expect(connector).toBeTruthy();
    expect(connector.bridge).toEqual(TEST_BRIDGE_URL);
  });

  it("connect two clients", async () => {
    const connectorA = new IsomorphicClient({
      bridge: TEST_BRIDGE_URL,
    });

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

          const connectorB = new IsomorphicClient({ uri });

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
