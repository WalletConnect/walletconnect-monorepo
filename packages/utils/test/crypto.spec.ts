import { expect, describe, it } from "vitest";
import { toString } from "uint8arrays/to-string";
import { safeJsonStringify } from "@walletconnect/safe-json";

import {
  BASE16,
  encrypt,
  decrypt,
  deriveSymKey,
  deserialize,
  generateKeyPair,
  hashKey,
  hashMessage,
  validateDecoding,
  isTypeOneEnvelope,
  generateRandomBytes32,
} from "../src";

import { TEST_KEY_PAIRS, TEST_SHARED_KEY, TEST_HASHED_KEY, TEST_SYM_KEY } from "./shared";

const TEST_MESSAGE = safeJsonStringify({
  id: 1,
  jsonrpc: "2.0",
  method: "test_method",
  params: {},
});

const TEST_SELF = TEST_KEY_PAIRS.A;
const TEST_PEER = TEST_KEY_PAIRS.B;

const TEST_IV = "717765636661617364616473";

const TEST_SEALED =
  "7a5a1e843debf98b01d6a75718b5ee27115eafa3caba9703ca1c5601a6af2419045320faec2073cc8b6b8dc439e63e21612ff3883c867e0bdcd72c833eb7f7bb2034a9ec35c2fb03d93732";

const TEST_ENCODED_TYPE_0 =
  "AHF3ZWNmYWFzZGFkc3paHoQ96/mLAdanVxi17icRXq+jyrqXA8ocVgGmryQZBFMg+uwgc8yLa43EOeY+IWEv84g8hn4L3Ncsgz6397sgNKnsNcL7A9k3Mg==";
const TEST_ENCODED_TYPE_1 =
  "Af96fVdnw2KwoXrZIpnr23gx3L2aVpWcATaMdARUOzNCcXdlY2ZhYXNkYWRzeloehD3r+YsB1qdXGLXuJxFer6PKupcDyhxWAaavJBkEUyD67CBzzItrjcQ55j4hYS/ziDyGfgvc1yyDPrf3uyA0qew1wvsD2Tcy";

const TEST_HASHED_MESSAGE = "15112289b5b794e68d1ea3cd91330db55582a37d0596f7b99ea8becdf9d10496";

describe("Crypto", () => {
  it("generateKeyPair", () => {
    const keyPair = generateKeyPair();
    expect(keyPair).to.not.be.undefined;
    expect(keyPair.privateKey).to.not.be.undefined;
    expect(keyPair.publicKey).to.not.be.undefined;
  });

  it("deriveSymKey", () => {
    const symKeyA = deriveSymKey(TEST_SELF.privateKey, TEST_PEER.publicKey);
    expect(symKeyA).to.eql(TEST_SYM_KEY);
    const symKeyB = deriveSymKey(TEST_PEER.privateKey, TEST_SELF.publicKey);
    expect(symKeyB).to.eql(TEST_SYM_KEY);
  });
  it("hashKey", () => {
    const hashedKey = hashKey(TEST_SHARED_KEY);
    expect(hashedKey).to.eql(TEST_HASHED_KEY);
  });
  it("hashMessage", () => {
    const hashedMessage = hashMessage(TEST_MESSAGE);
    expect(hashedMessage).to.eql(TEST_HASHED_MESSAGE);
  });
  it("encrypt (type 0)", () => {
    const encoded = encrypt({ symKey: TEST_SYM_KEY, message: TEST_MESSAGE, iv: TEST_IV });
    expect(encoded).to.eql(TEST_ENCODED_TYPE_0);
    const deserialized = deserialize(encoded);
    const iv = toString(deserialized.iv, BASE16);
    expect(iv).to.eql(TEST_IV);
    const sealed = toString(deserialized.sealed, BASE16);
    expect(sealed).to.eql(TEST_SEALED);
  });
  it("decrypt (type 0)", () => {
    const decrypted = decrypt({ symKey: TEST_SYM_KEY, encoded: TEST_ENCODED_TYPE_0 });
    expect(decrypted).to.eql(TEST_MESSAGE);
  });
  it("encrypt (type 1)", () => {
    const encoded = encrypt({
      type: 1,
      symKey: TEST_SYM_KEY,
      senderPublicKey: TEST_SELF.publicKey,
      message: TEST_MESSAGE,
      iv: TEST_IV,
    });
    expect(encoded).to.eql(TEST_ENCODED_TYPE_1);
    const deserialized = deserialize(encoded);
    const iv = toString(deserialized.iv, BASE16);
    expect(iv).to.eql(TEST_IV);
    const sealed = toString(deserialized.sealed, BASE16);
    expect(sealed).to.eql(TEST_SEALED);
  });
  it("decrypt (type 1)", () => {
    const encoded = TEST_ENCODED_TYPE_1;
    const params = validateDecoding(encoded, {
      receiverPublicKey: TEST_PEER.publicKey,
    });
    expect(isTypeOneEnvelope(params)).to.eql(true);
    if (!isTypeOneEnvelope(params)) return;
    expect(params.type).to.eql(1);
    expect(params.senderPublicKey).to.eql(TEST_SELF.publicKey);
    expect(params.receiverPublicKey).to.eql(TEST_PEER.publicKey);
    const symKey = deriveSymKey(TEST_PEER.privateKey, params.senderPublicKey);
    expect(symKey).to.eql(TEST_SYM_KEY);
    const decrypted = decrypt({ symKey, encoded });
    expect(decrypted).to.eql(TEST_MESSAGE);
  });
  it("calls generateRandomBytes32", () => {
    expect(generateRandomBytes32()).toBeTruthy();
  });
});
