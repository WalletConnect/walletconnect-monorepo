import { expect, describe, it } from "vitest";
import fetch from "node-fetch";
import { hashMessage } from "@walletconnect/utils";

import { Core, VERIFY_SERVER } from "../src";
import { disconnectSocket, TEST_CORE_OPTIONS } from "./shared";

describe("verify", () => {
  // skiping as now verify requires csrf token
  it.skip("should register attestation", async () => {
    const core = new Core(TEST_CORE_OPTIONS);
    await core.start();

    expect(core.expirer.length).to.eq(0);

    const POST_URL = `${VERIFY_SERVER}/attestation`;
    const attestationId = hashMessage("some");
    const origin = "localhost";

    const postResponse = await fetch(POST_URL, {
      method: "POST",
      body: JSON.stringify({ attestationId, origin }),
      headers: { "Content-Type": "application/json" },
    });

    expect(postResponse.status).toBe(200);

    const getResponse = await fetch(`${VERIFY_SERVER}/attestation/${attestationId}`);
    const result: any = await getResponse.json();

    expect(getResponse.status).toBe(200);
    expect(result.origin).toBe(origin);
    expect(result.attestationId).toBe(attestationId);

    await disconnectSocket(core.relayer);
  });
});
