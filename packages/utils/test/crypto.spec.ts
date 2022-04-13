import "mocha";
import { expect } from "chai";
import { toString } from "uint8arrays/to-string";
import { safeJsonStringify } from "@walletconnect/safe-json";

import {
  BASE16,
  deriveSharedKey,
  encrypt,
  decrypt,
  deriveSymmetricKey,
  deserialize,
  generateKeyPair,
  hashKey,
  hashMessage,
} from "../src";

import { TEST_KEY_PAIRS, TEST_SHARED_KEY, TEST_HASHED_KEY, TEST_SYM_KEY } from "./shared";

const TEST_MESSAGE = safeJsonStringify({
  id: 1,
  jsonrpc: "2.0",
  method: "test_method",
  params: {},
});
const TEST_SELF = TEST_KEY_PAIRS["A"];
const TEST_PEER = TEST_KEY_PAIRS["B"];
const TEST_IV = "717765636661617364616473";
const TEST_SEALED =
  "7a5a1e843debf98b01d6a75718b5ee27115eafa3caba9703ca1c5601a6af2419045320faec2073cc8b6b8dc439e63e21612ff3883c867e0bdcd72c833eb7f7bb2034a9ec35c2fb03d93732";
const TEST_ENCODED =
  "cXdlY2ZhYXNkYWRzeloehD3r+YsB1qdXGLXuJxFer6PKupcDyhxWAaavJBkEUyD67CBzzItrjcQ55j4hYS/ziDyGfgvc1yyDPrf3uyA0qew1wvsD2Tcy";
const TEST_HASHED_ENCODED = "50e7178d460f30f907c1744dd656aacbc2980f65de8d934c63ef83f607206603";

describe("Crypto", () => {
  it("generateKeyPair", async () => {
    const keyPair = generateKeyPair();
    expect(keyPair).to.not.be.undefined;
    expect(keyPair.privateKey).to.not.be.undefined;
    expect(keyPair.publicKey).to.not.be.undefined;
  });
  it("deriveSharedKey", async () => {
    const sharedKeyA = deriveSharedKey(TEST_SELF.privateKey, TEST_PEER.publicKey);
    expect(sharedKeyA).to.eql(TEST_SHARED_KEY);
    const sharedKeyB = deriveSharedKey(TEST_PEER.privateKey, TEST_SELF.publicKey);
    expect(sharedKeyB).to.eql(TEST_SHARED_KEY);
  });
  it("deriveSymmetricKey", async () => {
    const sharedKeyA = deriveSharedKey(TEST_SELF.privateKey, TEST_PEER.publicKey);
    const symKeyA = deriveSymmetricKey(sharedKeyA);
    expect(symKeyA).to.eql(TEST_SYM_KEY);
    const sharedKeyB = deriveSharedKey(TEST_PEER.privateKey, TEST_SELF.publicKey);
    const symKeyB = deriveSymmetricKey(sharedKeyB);
    expect(symKeyB).to.eql(TEST_SYM_KEY);
  });
  it("hashKey", async () => {
    const hashedKey = await hashKey(TEST_SHARED_KEY);
    expect(hashedKey).to.eql(TEST_HASHED_KEY);
  });
  it("hashMessage", async () => {
    const hashedEncoded = await hashMessage(TEST_ENCODED);
    expect(hashedEncoded).to.eql(TEST_HASHED_ENCODED);
  });
  it("encrypt", async () => {
    const encoded = await encrypt({ symKey: TEST_SYM_KEY, message: TEST_MESSAGE, iv: TEST_IV });
    expect(encoded).to.eql(TEST_ENCODED);
    const deserialized = deserialize(encoded);
    const iv = toString(deserialized.iv, BASE16);
    expect(iv).to.eql(TEST_IV);
    const sealed = toString(deserialized.sealed, BASE16);
    expect(sealed).to.eql(TEST_SEALED);
  });
  it("decrypt", async () => {
    const decrypted = await decrypt({ symKey: TEST_SYM_KEY, encoded: TEST_ENCODED });
    expect(decrypted).to.eql(TEST_MESSAGE);
  });
});
