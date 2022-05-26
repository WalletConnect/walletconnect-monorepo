import "mocha";
import { expect } from "chai";
import { ICreateSessionOptions } from "@walletconnect/legacy-types";

import IsomorphicClient from "../../src";

import { TEST_BRIDGE_URL, TEST_SESSION_PARAMS } from "./values";

interface IConnectTwoClients extends ICreateSessionOptions {
  logger?: boolean;
}

export async function connectTwoClients(opts?: IConnectTwoClients) {
  const sessionParams = {
    ...TEST_SESSION_PARAMS,
    chainId: opts?.chainId || TEST_SESSION_PARAMS.chainId,
  };

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
        expect(connectorA.accounts).to.eql(sessionParams.accounts);
        expect(connectorA.chainId).to.eql(sessionParams.chainId);
        resolve();
      });
    }),
    new Promise<void>((resolve, reject) => {
      connectorA.on("display_uri", (error, payload) => {
        if (error) {
          reject(error);
        }
        const uri = payload.params[0];
        if (opts?.logger) {
          console.log(uri); // eslint-disable-line
        }

        connectorB = new IsomorphicClient({ uri });
        if (opts?.logger) {
          console.log(!!connectorB); // eslint-disable-line
        }

        // Subscribe to session requests
        connectorB.on("session_request", (error, _payload) => {
          if (error) {
            reject(error);
          }
          if (typeof connectorB === "undefined") {
            throw new Error("Peer connector is undefined");
          }
          connectorB.approveSession(sessionParams);

          expect(connectorB.connected).to.be.true;
          expect(connectorB.accounts).to.eql(sessionParams.accounts);
          expect(connectorB.chainId).to.eql(sessionParams.chainId);
          resolve();
        });
      });
    }),
    new Promise<void>((resolve, reject) => {
      connectorA
        .createSession(opts)
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
