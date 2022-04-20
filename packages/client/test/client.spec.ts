import "mocha";

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

    const { uri, approval } = await A.connect({
      methods: ["test_method"],
      chains: TEST_PERMISSIONS_CHAINS,
    });
    await B.pair({ uri });

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        B.on("session_proposal", async data => {
          try {
            const proposerPublicKey = data.proposer.publicKey;
            await B.approve({
              proposerPublicKey,
              accounts: TEST_SESSION_ACCOUNTS,
              methods: data.methods,
              events: data.events,
            });
            resolve();
          } catch (e) {
            reject(e);
          }
        });
      }),
      new Promise<void>(async (resolve, reject) => {
        try {
          const session = await approval();
          resolve();
        } catch (error) {
          reject(error);
        }
      }),
    ]);
  });
});
