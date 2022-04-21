import "mocha";
// import { expect } from "chai";

import { SessionTypes } from "@walletconnect/types";

import Client from "../src";

import {
  expect,
  TEST_CLIENT_OPTIONS,
  TEST_PERMISSIONS_CHAINS,
  TEST_SESSION_ACCOUNTS,
} from "./shared";

describe("Client", () => {
  it("instantiate successfully", async () => {
    const client = await Client.init(TEST_CLIENT_OPTIONS);
    expect(client).to.be.exist;
  });
  it("connect", async () => {
    const A = await Client.init({ ...TEST_CLIENT_OPTIONS, name: "client_a" });
    const B = await Client.init({ ...TEST_CLIENT_OPTIONS, name: "client_b" });

    // eslint-disable-next-line
    console.log("A.name", A.name);
    // eslint-disable-next-line
    console.log("B.name", B.name);

    const { uri, approval } = await A.connect({
      methods: ["test_method"],
      chains: TEST_PERMISSIONS_CHAINS,
    });

    let sessionA: SessionTypes.Struct | undefined;
    let sessionB: SessionTypes.Struct | undefined;

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        // eslint-disable-next-line
        console.log("1");
        // eslint-disable-next-line
        console.log('on("session_proposal")');
        B.on("session_proposal", async data => {
          // eslint-disable-next-line
          console.log("session_proposal", data);

          try {
            const { acknowledged } = await B.approve({
              requestId: data.requestId,
              accounts: TEST_SESSION_ACCOUNTS,
              methods: data.methods,
              events: data.events,
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
        // eslint-disable-next-line
        console.log("2");
        try {
          if (uri) {
            // eslint-disable-next-line
            console.log("uri", uri);

            const pairing = await B.pair({ uri });
            // eslint-disable-next-line
            console.log("pairing", pairing);
            resolve();
          } else {
            reject(new Error("missing uri"));
          }
        } catch (error) {
          reject(error);
        }
      }),
      new Promise<void>(async (resolve, reject) => {
        // eslint-disable-next-line
        console.log("3");
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

    // eslint-disable-next-line
    console.log("sessionA", sessionA);
    // eslint-disable-next-line
    console.log("sessionB", sessionB);
    expect(sessionA?.topic).to.eql(sessionB?.topic);
  });
});
