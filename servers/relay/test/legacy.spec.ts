import "mocha";
import { expect } from "chai";

import { Socket, TEST_RELAY_URL } from "./shared";
import { getTestLegacy } from "./shared/message";

describe("Legacy", () => {
  it("A can publish to B subscribed to same topic", async () => {
    const { pub, sub } = getTestLegacy();

    const socketA = new Socket(TEST_RELAY_URL);
    await socketA.open();
    const socketB = new Socket(TEST_RELAY_URL);
    await socketB.open();

    await Promise.all([
      new Promise<void>(resolve => {
        socketB.send(sub);
        resolve();
      }),
      new Promise<void>(resolve => {
        socketA.send(pub);
        resolve();
      }),
      new Promise<void>(resolve => {
        socketB.on("message", message => {
          expect(message).to.eql(pub);
          resolve();
        });
      }),
    ]);
  });
  it("A can publish to B and C subscribed to same topic", async () => {
    const { pub, sub } = getTestLegacy();

    const socketA = new Socket(TEST_RELAY_URL);
    await socketA.open();
    const socketB = new Socket(TEST_RELAY_URL);
    await socketB.open();
    const socketC = new Socket(TEST_RELAY_URL);
    await socketC.open();

    await Promise.all([
      new Promise<void>(resolve => {
        socketB.send(sub);
        resolve();
      }),
      new Promise<void>(resolve => {
        socketC.send(sub);
        resolve();
      }),
      new Promise<void>(resolve => {
        socketA.send(pub);
        resolve();
      }),
      new Promise<void>(resolve => {
        socketB.on("message", message => {
          expect(message).to.eql(pub);
          resolve();
        });
      }),
      new Promise<void>(resolve => {
        socketC.on("message", message => {
          expect(message).to.eql(pub);
          resolve();
        });
      }),
    ]);
    // await delay(10_000);
  });
  it("B can receive pending messages published while offline", async () => {
    const { pub, sub } = getTestLegacy();

    const socketA = new Socket(TEST_RELAY_URL);
    await socketA.open();

    await socketA.send(pub);

    const socketB = new Socket(TEST_RELAY_URL);
    await socketB.open();

    await Promise.all([
      new Promise<void>(resolve => {
        socketB.send(sub);
        resolve();
      }),
      new Promise<void>(resolve => {
        socketB.on("message", message => {
          expect(message).to.eql(pub);
          resolve();
        });
      }),
    ]);

    const socketC = new Socket(TEST_RELAY_URL);
    await socketC.open();

    await Promise.all([
      new Promise<void>(resolve => {
        socketC.send(sub);
        resolve();
      }),
      new Promise<void>((resolve, reject) => {
        setTimeout(() => {
          resolve();
        }, 100);
        socketC.on("message", () => {
          reject("Socket C received message after B");
        });
      }),
    ]);
  });
});
