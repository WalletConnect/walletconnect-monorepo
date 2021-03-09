import IsomorphicClient from "../../src";
import { TEST_BRIDGE_URL, TEST_SESSION_PARAMS } from "./values";

export async function connectTwoClients() {
  let connectorB: IsomorphicClient | undefined;
  const connectorA = new IsomorphicClient({
    bridge: TEST_BRIDGE_URL,
  });

  await Promise.all([
    new Promise<void>((resolve, reject) => {
      connectorA.on("connect", (error) => {
        if (error) {
          reject(error);
        }
        expect(connectorA.connected).toBeTruthy();
        expect(connectorA.accounts).toEqual(TEST_SESSION_PARAMS.accounts);
        expect(connectorA.chainId).toEqual(TEST_SESSION_PARAMS.chainId);
        resolve();
      });
    }),
    new Promise<void>((resolve, reject) => {
      connectorA.on("display_uri", (error, payload) => {
        if (error) {
          reject(error);
        }
        const uri = payload.params[0];

        connectorB = new IsomorphicClient({ uri });

        // Subscribe to session requests
        connectorB.on("session_request", (error) => {
          if (error) {
            reject(error);
          }
          if (typeof connectorB === "undefined") {
            throw new Error("Peer connector is undefined");
          }
          connectorB.approveSession(TEST_SESSION_PARAMS);

          expect(connectorB.connected).toBeTruthy();
          expect(connectorB.accounts).toEqual(TEST_SESSION_PARAMS.accounts);
          expect(connectorB.chainId).toEqual(TEST_SESSION_PARAMS.chainId);
          resolve();
        });
      });
    }),
    new Promise<void>((resolve, reject) => {
      connectorA
        .createSession()
        .then(() => {
          resolve();
        })
        .catch((e) => reject(e));
    }),
  ]);
  if (typeof connectorB === "undefined") {
    throw new Error("Peer connector is undefined");
  }
  expect(!!connectorA.connected).toBeTruthy();
  expect(!!connectorA.clientId).toBeTruthy();
  expect(connectorA.clientId).toEqual(connectorB.peerId);
  expect(!!connectorA.peerId).toBeTruthy();
  expect(connectorA.peerId).toEqual(connectorB.clientId);
  expect(!!connectorB.connected).toBeTruthy();
  expect(!!connectorB.clientId).toBeTruthy();
  expect(connectorB.clientId).toEqual(connectorA.peerId);
  expect(!!connectorB.peerId).toBeTruthy();
  expect(connectorB.peerId).toEqual(connectorA.clientId);
  return connectorA.clientId;
}
