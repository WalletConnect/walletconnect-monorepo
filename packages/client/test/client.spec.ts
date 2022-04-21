import "mocha";
// import { expect } from "chai";

import { parseUri } from "@walletconnect/utils";
import { PairingTypes, SessionTypes } from "@walletconnect/types";

import Client from "../src";

import {
  expect,
  TEST_CLIENT_OPTIONS,
  TEST_CHAINS,
  TEST_METHODS,
  TEST_EVENTS,
  TEST_ACCOUNTS,
  TEST_RELAY_OPTIONS,
} from "./shared";

describe("Client", () => {
  it("init", async () => {
    const client = await Client.init(TEST_CLIENT_OPTIONS);
    expect(client).to.be.exist;
  });
  it("connect (with new pairing)", async () => {
    const A = await Client.init({ ...TEST_CLIENT_OPTIONS, name: "client_a" });
    const B = await Client.init({ ...TEST_CLIENT_OPTIONS, name: "client_b" });

    const { uri, approval } = await A.connect({
      methods: TEST_METHODS,
      chains: TEST_CHAINS,
      events: TEST_EVENTS,
    });

    if (!uri) throw new Error("uri is missing");

    const uriParams = parseUri(uri);

    const pairingA = await A.pairing.get(uriParams.topic);
    expect(pairingA.topic).to.eql(uriParams.topic);
    expect(pairingA.relay).to.eql(uriParams.relay);

    let pairingB: PairingTypes.Struct | undefined;
    let sessionA: SessionTypes.Struct | undefined;
    let sessionB: SessionTypes.Struct | undefined;

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        B.on("session_proposal", async proposal => {
          try {
            expect(proposal.chains).to.eql(TEST_CHAINS);
            expect(proposal.methods).to.eql(TEST_METHODS);
            expect(proposal.events).to.eql(TEST_EVENTS);

            const { acknowledged } = await B.approve({
              id: proposal.id,
              accounts: TEST_ACCOUNTS,
              methods: proposal.methods,
              events: proposal.events,
            });
            if (!sessionB) {
              sessionB = await acknowledged();
            }
            resolve();
          } catch (e) {
            reject(e);
          }
        });
      }),
      new Promise<void>(async (resolve, reject) => {
        try {
          if (uri) {
            pairingB = await B.pair({ uri });
            expect(pairingB.topic).to.eql(pairingA.topic);
            expect(pairingB.relay).to.eql(pairingA.relay);
            resolve();
          } else {
            reject(new Error("missing uri"));
          }
        } catch (error) {
          reject(error);
        }
      }),
      new Promise<void>(async (resolve, reject) => {
        try {
          if (!sessionA) {
            sessionA = await approval();
          }
          resolve();
        } catch (error) {
          reject(error);
        }
      }),
    ]);

    if (!sessionA) throw new Error("expect session A to be defined");
    if (!sessionB) throw new Error("expect session B to be defined");
    expect(sessionA.topic).to.eql(sessionB.topic);
    // relay
    expect(sessionA.relay).to.eql(TEST_RELAY_OPTIONS);
    expect(sessionA.relay).to.eql(sessionB.relay);
    // accounts
    expect(sessionA.accounts).to.eql(TEST_ACCOUNTS);
    expect(sessionA.accounts).to.eql(sessionB.accounts);
    // methods
    expect(sessionA.methods).to.eql(TEST_METHODS);
    expect(sessionA.methods).to.eql(sessionB.methods);
    // events
    expect(sessionA.events).to.eql(TEST_EVENTS);
    expect(sessionA.events).to.eql(sessionB.events);
    // expiry
    expect(sessionA.expiry).to.eql(sessionB.expiry);
    // acknowledged
    expect(sessionA.acknowledged).to.eql(sessionB.acknowledged);
    // participants
    expect(sessionA.self).to.eql(sessionB.peer);
    expect(sessionA.peer).to.eql(sessionB.self);
    // controller
    expect(sessionA.controller).to.eql(sessionB.controller);
    expect(sessionA.controller).to.eql(sessionA.peer.publicKey);
    expect(sessionB.controller).to.eql(sessionB.self.publicKey);
  });
});
