import "mocha";
import { expect } from "chai";
import { toString } from "uint8arrays/to-string";
import { safeJsonStringify } from "@walletconnect/safe-json";

import {
  deriveSharedKey,
  encrypt,
  sha256,
  decrypt,
  deriveSymmetricKey,
  deserialize,
  generateKeyPair,
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

describe("Crypto", () => {
  it("generateKeyPair", async () => {
    const keyPair = generateKeyPair();
    expect(keyPair).to.not.be.undefined;
    expect(keyPair.privateKey).to.not.be.undefined;
    expect(keyPair.publicKey).to.not.be.undefined;
  });
  it("deriveSharedKey", async () => {
    const sharedKey = deriveSharedKey(TEST_SELF.privateKey, TEST_PEER.publicKey);
    expect(sharedKey).to.eql(TEST_SHARED_KEY);
  });
  it("deriveSymmetricKey", async () => {
    const sharedKey = deriveSharedKey(TEST_SELF.privateKey, TEST_PEER.publicKey);
    const symKey = deriveSymmetricKey(sharedKey);
    expect(symKey).to.eql(TEST_SYM_KEY);
  });
  it("sha256", async () => {
    const hash = await sha256(TEST_SHARED_KEY);
    expect(hash).to.eql(TEST_HASHED_KEY);
  });
  it("encrypt", async () => {
    const encoded = await encrypt({ symKey: TEST_SYM_KEY, message: TEST_MESSAGE, iv: TEST_IV });
    expect(encoded).to.eql(TEST_ENCODED);
    const deserialized = deserialize(encoded);
    const iv = toString(deserialized.iv, "base16");
    expect(iv).to.eql(TEST_IV);
    const sealed = toString(deserialized.sealed, "base16");
    expect(sealed).to.eql(TEST_SEALED);
  });
  it("decrypt", async () => {
    const decrypted = await decrypt({ symKey: TEST_SYM_KEY, encoded: TEST_ENCODED });
    expect(decrypted).to.eql(TEST_MESSAGE);
  });
});
