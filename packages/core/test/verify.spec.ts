import { expect, describe, it, vi } from "vitest";
import Sinon from "sinon";
import { hashMessage } from "@walletconnect/utils";

import { Core, VERIFY_SERVER } from "../src";
import { disconnectSocket, TEST_CORE_OPTIONS } from "./shared";

vi.mock("@walletconnect/relay-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@walletconnect/relay-auth")>();
  return {
    ...actual,
    // Return a payload whose id matches the encryptedId used in the tests below,
    // so `resolve` proceeds past the id check without a real signed token.
    decodeJWT: () => ({ payload: { id: "encrypted-id" } }),
  };
});

// TODO: re-enable this suite when we have a way to provide/mock CSRF token now required by the server.
describe.skip("verify", () => {
  it("should register attestation", async () => {
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

describe("verify resolve", () => {
  it("resolves to unknown without a legacy lookup when a v2 attestation is present but not validated", async () => {
    const core = new Core(TEST_CORE_OPTIONS);
    const verify: any = core.verify;
    verify.isDevEnv = false;
    // Simulate a v2 attestation that is present but cannot be validated.
    verify.isValidJwtAttestation = async () => undefined;
    const lookupSpy = Sinon.spy();
    verify.fetchAttestation = lookupSpy;

    const result = await verify.resolve({
      attestationId: "header.payload.signature",
      hash: "some-hash",
      encryptedId: "encrypted-id",
    });

    expect(result).to.be.undefined;
    expect(lookupSpy.called).to.be.false;
  });

  it("still performs the lookup when no attestation was present", async () => {
    const core = new Core(TEST_CORE_OPTIONS);
    const verify: any = core.verify;
    verify.isDevEnv = false;
    const lookupResult = { origin: "https://example.com", isScam: false, isVerified: true };
    const lookupSpy = Sinon.spy(async () => lookupResult);
    verify.fetchAttestation = lookupSpy;

    const result = await verify.resolve({
      attestationId: undefined,
      hash: "some-hash",
      encryptedId: "encrypted-id",
    });

    expect(lookupSpy.called).to.be.true;
    expect(result).to.deep.equal(lookupResult);
  });
});
