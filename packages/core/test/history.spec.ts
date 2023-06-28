import { vi, expect, describe, it, beforeEach, afterEach } from "vitest";
import { calcExpiry } from "@walletconnect/utils";

import { Core, HISTORY_EVENTS } from "../src";
import { disconnectSocket, TEST_CORE_OPTIONS } from "./shared";
import { ICore, JsonRpcRecord } from "@walletconnect/types";
import { THIRTY_DAYS, toMiliseconds, fromMiliseconds } from "@walletconnect/time";

describe("history", () => {
  let core: ICore;
  beforeEach(async () => {
    core = new Core(TEST_CORE_OPTIONS);
    await core.start();
  });
  it("should set a record expiry", async () => {
    expect(core.history.records.size).to.eq(0);
    const request = {
      id: 1687958477400360,
      topic: "24fd0e137c4ccc655ca9e1b9d0e2481bb3d028dc307edc62d2a5190bb081c1b9",
      jsonrpc: "2.0",
      method: "test",
      params: {
        request: {
          method: "personal_sign",
          params: [
            "0x4d7920656d61696c206973206a6f686e40646f652e636f6d202d2031363837393538343737333838",
            "0x7770471b86c6dd889a6D81DA53Fb7eeE1F9a2ba7",
          ],
        },
        chainId: "eip155:5",
      },
    };
    core.history.set(request.topic, request);
    expect(core.history.records.size).to.eq(1);
    const record = core.history.records.get(request.id);
    expect(record).to.not.be.undefined;
    expect(record?.expiry).to.not.be.undefined;
    expect(record?.expiry).to.be.greaterThan(0);
    expect(record?.expiry).to.be.approximately(calcExpiry(THIRTY_DAYS), 10); // delta ~10ms execution variance

    vi.useFakeTimers();
    vi.advanceTimersByTime(toMiliseconds(calcExpiry(THIRTY_DAYS)));
    // move time forward to force expiry and wait for heartbeat to delete the record
    await new Promise<void>((resolve) => {
      core.history.on(HISTORY_EVENTS.deleted, (record: JsonRpcRecord) => {
        expect(record).to.not.be.undefined;
        expect(record.id).to.eq(request.id);
        resolve();
      });
    });
    vi.useRealTimers();
    expect(core.history.records.size).to.eq(0);
  });
  afterEach(async () => {
    await disconnectSocket(core.relayer);
  });
});
