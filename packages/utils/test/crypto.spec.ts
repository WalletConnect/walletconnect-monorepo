import "mocha";
import * as chai from "chai";
import * as encUtils from "enc-utils";
import { safeJsonStringify } from "safe-json-utils";

import {
  deriveSharedKey,
  encrypt,
  sha256,
  decrypt,
  encodeEncryptedMessage,
  decodeEncryptedMessage,
} from "../src";

const TEST_KEY_PAIRS = {
  A: {
    privateKey: "ef1b823316362facbc6b91e56f9ca9b30307f3d568546b9e093a2a50232806a7",
    publicKey: "03c96ae71f5abf658fafa789d90060fcc16cadf2515a9aab9c6b47e04c40164568",
  },
  B: {
    privateKey: "2e4e06116d04373db48ddc53ca119ac37ca1e32f460bb291c1794b1a0c299116",
    publicKey: "037e230250164941426bd5cf197d1fc432b3c6a9b9a66ec485b8762859e042cf39",
  },
};

const TEST_SHARED_KEY = "55c5ffa1de581daf8b636812db6a63d74c9b11ab2ac060f3119053050722fcab";
const TEST_HASHED_KEY = "62098d7cfd518fe33119a48f29410c1998a86f350199b97027635a896aca6e05";

const TEST_MESSAGE = safeJsonStringify({
  id: 1,
  jsonrpc: "2.0",
  method: "test_method",
  params: {},
});
const TEST_IV = "f5c7994f0597d49d50a6eb64e581c259";
const TEST_MAC = "06347feffbd4c7ee606c38d36adb0ffa14d159197a2bf2c473ce305f79688e14";
const TEST_DATA =
  "40f5679e4483b8cf7d044f1c010ee29d6520a5ef5be4faaa5952085a9a933c0ee27b35cee6b3493e6da3b1748d8be1d7704edf7fde0fdb9cc6b5f00ad8d3a9ee";
const TEST_ENCRYPTED = TEST_IV + TEST_MAC + TEST_DATA;

describe("Crypto", () => {
  it("deriveSharedKey", async () => {
    const sharedKey = deriveSharedKey(
      TEST_KEY_PAIRS["A"].privateKey,
      TEST_KEY_PAIRS["B"].publicKey,
    );
    chai.expect(sharedKey).to.eql(TEST_SHARED_KEY);
  });
  it("sha256", async () => {
    const hash = await sha256(TEST_SHARED_KEY);
    chai.expect(hash).to.eql(TEST_HASHED_KEY);
  });
  it("encodeEncryptedMessage", async () => {
    const encoded = await encodeEncryptedMessage({
      iv: encUtils.hexToBuffer(TEST_IV),
      mac: encUtils.hexToBuffer(TEST_MAC),
      data: encUtils.hexToBuffer(TEST_DATA),
    });
    chai.expect(encoded).to.eql(TEST_ENCRYPTED);
  });
  it("decodeEncryptedMessage", async () => {
    const decoded = await decodeEncryptedMessage(TEST_ENCRYPTED);
    chai.expect(encUtils.bufferToHex(decoded.iv)).to.eql(TEST_IV);
    chai.expect(encUtils.bufferToHex(decoded.mac)).to.eql(TEST_MAC);
    chai.expect(encUtils.bufferToHex(decoded.data)).to.eql(TEST_DATA);
  });
  it("encrypt", async () => {
    const encrypted = await encrypt({
      iv: TEST_IV,
      message: TEST_MESSAGE,
      sharedKey: TEST_SHARED_KEY,
      publicKey: TEST_KEY_PAIRS["A"].publicKey,
    });
    chai.expect(encrypted).to.eql(TEST_ENCRYPTED);
  });
  it("decrypt", async () => {
    const decrypted = await decrypt({
      encrypted: TEST_ENCRYPTED,
      sharedKey: TEST_SHARED_KEY,
      publicKey: TEST_KEY_PAIRS["A"].publicKey,
    });
    chai.expect(decrypted).to.eql(TEST_MESSAGE);
  });
});
