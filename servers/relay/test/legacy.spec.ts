import "mocha";
import { expect } from "chai";

import { Counter, Socket, TEST_RELAY_URL } from "./shared";
import { getTestLegacy } from "./shared/message";

describe("LEGACY", () => {
  it("A can publish to B subscribed to same topic", async () => {
    const { pub, sub } = getTestLegacy();

    const socketA = new Socket(TEST_RELAY_URL);
    await socketA.open();
    const socketB = new Socket(TEST_RELAY_URL);
    await socketB.open();

    const counterB = new Counter();

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
          counterB.tick();
          expect(message).to.eql(pub);
          resolve();
        });
      }),
    ]);

    expect(counterB.value).to.eql(1);
  });
  it("A can publish to B and C subscribed to same topic", async () => {
    const { pub, sub } = getTestLegacy();

    const socketA = new Socket(TEST_RELAY_URL);
    await socketA.open();
    const socketB = new Socket(TEST_RELAY_URL);
    await socketB.open();
    const socketC = new Socket(TEST_RELAY_URL);
    await socketC.open();

    const counterB = new Counter();
    const counterC = new Counter();

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
          counterB.tick();
          expect(message).to.eql(pub);
          resolve();
        });
      }),
      new Promise<void>(resolve => {
        socketC.on("message", message => {
          counterC.tick();
          expect(message).to.eql(pub);
          resolve();
        });
      }),
    ]);

    expect(counterB.value).to.eql(1);
    expect(counterC.value).to.eql(1);
  });
  it("B can receive pending messages published while offline", async () => {
    const { pub, sub } = getTestLegacy();

    const socketA = new Socket(TEST_RELAY_URL);
    await socketA.open();
    await socketA.send(pub);
    const socketB = new Socket(TEST_RELAY_URL);
    await socketB.open();
    const counterB = new Counter();

    await Promise.all([
      new Promise<void>(async resolve => {
        await socketB.send(sub);
        resolve();
      }),
      new Promise<void>(resolve => {
        socketB.on("message", message => {
          counterB.tick();
          expect(message).to.eql(pub);
          resolve();
        });
      }),
    ]);

    expect(counterB.value).to.eql(1);
  });
});
