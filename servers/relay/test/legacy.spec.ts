import "mocha";
import { expect } from "chai";

import { Socket, TEST_RELAY_URL, TEST_TOPIC, TEST_MESSAGE } from "./shared";
import { LegacySocketMessage } from "../src/types";

const TEST_PUB_MESSAGE: LegacySocketMessage = {
  topic: TEST_TOPIC,
  type: "pub",
  payload: TEST_MESSAGE,
  silent: true,
};

const TEST_SUB_MESSAGE: LegacySocketMessage = {
  topic: TEST_TOPIC,
  type: "sub",
  payload: "",
  silent: true,
};

describe("Legacy", () => {
  it("A can publish to B subscribed to same topic", async () => {
    const socketA = new Socket(TEST_RELAY_URL);
    await socketA.open();
    const socketB = new Socket(TEST_RELAY_URL);
    await socketB.open();

    let counter = 0;
    await Promise.all([
      new Promise<void>(resolve => {
        socketB.send(TEST_SUB_MESSAGE);
        resolve();
      }),
      new Promise<void>(resolve => {
        socketA.send(TEST_PUB_MESSAGE);
        resolve();
      }),
      new Promise<void>(resolve => {
        socketB.on("message", message => {
          counter += 1;
          // eslint-disable-next-line
          // console.log("Legacy", counter);
          expect(message).to.eql(TEST_PUB_MESSAGE);
          resolve();
        });
      }),
    ]);
  });
  it("A can publish to B and C subscribed to same topic", async () => {
    const socketA = new Socket(TEST_RELAY_URL);
    await socketA.open();
    const socketB = new Socket(TEST_RELAY_URL);
    await socketB.open();
    const socketC = new Socket(TEST_RELAY_URL);
    await socketC.open();

    let counter = 0;
    await Promise.all([
      new Promise<void>(resolve => {
        socketB.send(TEST_SUB_MESSAGE);
        resolve();
      }),
      new Promise<void>(resolve => {
        socketC.send(TEST_SUB_MESSAGE);
        resolve();
      }),
      new Promise<void>(resolve => {
        socketA.send(TEST_PUB_MESSAGE);
        resolve();
      }),
      new Promise<void>(resolve => {
        socketB.on("message", message => {
          counter += 1;
          // eslint-disable-next-line
          // console.log("Legacy", counter);
          expect(message).to.eql(TEST_PUB_MESSAGE);
          resolve();
        });
      }),
      new Promise<void>(resolve => {
        socketC.on("message", message => {
          resolve();
        });
      }),
    ]);
  });
  it("B can receive pending messages published while offline", async () => {
    const socketA = new Socket(TEST_RELAY_URL);
    await socketA.open();

    await socketA.send(TEST_PUB_MESSAGE);

    const socketB = new Socket(TEST_RELAY_URL);
    await socketB.open();

    let counter = 0;
    await Promise.all([
      new Promise<void>(resolve => {
        socketB.send(TEST_SUB_MESSAGE);
        resolve();
      }),
      new Promise<void>(resolve => {
        socketB.on("message", message => {
          counter += 1;
          // eslint-disable-next-line
          // console.log("Legacy", counter);
          expect(message).to.eql(TEST_PUB_MESSAGE);
          resolve();
        });
      }),
    ]);
  });
});
