import { expect, describe, it } from "vitest";
import { calcExpiry, formatExpirerTarget } from "@walletconnect/utils";

import { Core, EXPIRER_EVENTS } from "../src";
import { disconnectSocket, TEST_CORE_OPTIONS } from "./shared";
import { HEARTBEAT_EVENTS } from "@walletconnect/heartbeat";

describe("Expirer", () => {
  it("should expire payload", async () => {
    const core = new Core(TEST_CORE_OPTIONS);
    await core.start();
    // confirm the expirer is empty
    expect(core.expirer.length).to.eq(0);
    // set a payload
    const topic = "test";
    core.expirer.set(topic, calcExpiry(1));
    // confirm the expirer is not empty
    expect(core.expirer.length).to.eq(1);
    setTimeout(() => {
      // emit heartbeat pulse event to trigger expirer
      core.heartbeat.events.emit(HEARTBEAT_EVENTS.pulse);
    }, 1_000);
    await new Promise<void>((resolve) => {
      core.expirer.on(EXPIRER_EVENTS.expired, (payload: any) => {
        expect(payload.target).to.eq(formatExpirerTarget("topic", topic));
        // confirm the expirer is empty again
        expect(core.expirer.length).to.eq(0);
        resolve();
      });
    });
    await disconnectSocket(core.relayer);
  });
});
