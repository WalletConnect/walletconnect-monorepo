import "mocha";
import { expect } from "chai";

import IsomorphicClient from "../../src";

import { TEST_BRIDGE_URL, TEST_SESSION_PARAMS } from "./values";

export async function connectTwoClients() {
  let connectorB: IsomorphicClient | undefined;
  const connectorA = new IsomorphicClient({
    bridge: TEST_BRIDGE_URL,
  });

  await Promise.all([
    new Promise<void>((resolve, reject) => {
      connectorA.on("connect", error => {
        if (error) {
          reject(error);
        }
        expect(connectorA.connected).to.be.true;
        expect(connectorA.accounts).to.eql(TEST_SESSION_PARAMS.accounts);
        expect(connectorA.chainId).to.eql(TEST_SESSION_PARAMS.chainId);
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
        connectorB.on("session_request", error => {
          if (error) {
            reject(error);
          }
          if (typeof connectorB === "undefined") {
            throw new Error("Peer connector is undefined");
          }
          connectorB.approveSession(TEST_SESSION_PARAMS);

          expect(connectorB.connected).to.be.true;
          expect(connectorB.accounts).to.eql(TEST_SESSION_PARAMS.accounts);
          expect(connectorB.chainId).to.eql(TEST_SESSION_PARAMS.chainId);
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
        .catch(e => reject(e));
    }),
  ]);
  if (typeof connectorB === "undefined") {
    throw new Error("Peer connector is undefined");
  }
  expect(!!connectorA.connected).to.be.true;
  expect(!!connectorA.clientId).to.be.true;
  expect(connectorA.clientId).to.eql(connectorB.peerId);
  expect(!!connectorA.peerId).to.be.true;
  expect(connectorA.peerId).to.eql(connectorB.clientId);
  expect(!!connectorB.connected).to.be.true;
  expect(!!connectorB.clientId).to.be.true;
  expect(connectorB.clientId).to.eql(connectorA.peerId);
  expect(!!connectorB.peerId).to.be.true;
  expect(connectorB.peerId).to.eql(connectorA.clientId);
  return connectorA.clientId;
}
