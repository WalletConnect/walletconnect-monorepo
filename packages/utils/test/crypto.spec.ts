import "mocha";
import * as chai from "chai";
import * as eccies25519 from "ecies-25519";
import * as encUtils from "enc-utils";
import { safeJsonStringify } from "safe-json-utils";

import { deriveSharedKey, encrypt, sha256, decrypt } from "../src";

const TEST_KEY_PAIRS = {
  A: {
    privateKey: "0a857b942485fee18e4c55b6ec02fef6fc0c1c3872c10e669c7790f315fd3d0b",
    publicKey: "7ff3e362f825ab868e20e767fe580d0311181632707e7c878cbeca0238d45b8b",
  },
  B: {
    privateKey: "a2582f40f38e32546df2cd8f25f19265386820347237c234a223a0d4704f3940",
    publicKey: "45c59ad0c053925072f4503a39fe579ca8b7b8fa6bf0c7297e6db8f6585ee77f",
  },
};

const TEST_SHARED_KEY = "1b665e13f74b54aa2401bb8762b6fe06b3fdcf4c248ff0bde8781c3b02f23b06";
const TEST_HASHED_KEY = "08ca02463e7c45383d43efaee4bbe33f700df0658e99726a755fd77f9a040988";

const TEST_MESSAGE = safeJsonStringify({
  id: 1,
  jsonrpc: "2.0",
  method: "test_method",
  params: {},
});
const TEST_SELF = TEST_KEY_PAIRS["A"];
const TEST_IV = "f0d00d4274a7e9711e4e0f21820b8877";
const TEST_PEER = TEST_KEY_PAIRS["B"];
const TEST_MAC = "fc6d3106fa827043279f9db08cd2e29a988c7272fa3cfdb739163bb9606822c7";
const TEST_CIPHERTEXT =
  "14aa7f6034dd0213be5901b472f461769855ac1e2f6bec6a8ed1157a9da3b2df08802cbd6e0d030d86ff99011040cfc831eec3636c1d46bfc22cbe055560fea3";
const TEST_ENCRYPTED = TEST_IV + TEST_SELF.publicKey + TEST_MAC + TEST_CIPHERTEXT;

describe("Crypto", () => {
  it("deriveSharedKey", async () => {
    const sharedKey = deriveSharedKey(TEST_SELF.privateKey, TEST_PEER.publicKey);
    chai.expect(sharedKey).to.eql(TEST_SHARED_KEY);
  });
  it("sha256", async () => {
    const hash = await sha256(TEST_SHARED_KEY);
    chai.expect(hash).to.eql(TEST_HASHED_KEY);
  });
  it("encrypt", async () => {
    const encrypted = await encrypt({
      iv: TEST_IV,
      message: TEST_MESSAGE,
      sharedKey: TEST_SHARED_KEY,
      publicKey: TEST_SELF.publicKey,
    });
    const deserialized = eccies25519.deserialize(encUtils.hexToArray(encrypted));
    const iv = encUtils.arrayToHex(deserialized.iv);
    chai.expect(iv).to.eql(TEST_IV);
    const publicKey = encUtils.arrayToHex(deserialized.publicKey);
    chai.expect(publicKey).to.eql(TEST_SELF.publicKey);
    const mac = encUtils.arrayToHex(deserialized.mac);
    chai.expect(mac).to.eql(TEST_MAC);
    const ciphertext = encUtils.arrayToHex(deserialized.ciphertext);
    chai.expect(ciphertext).to.eql(TEST_CIPHERTEXT);
  });
  it("decrypt", async () => {
    const decrypted = await decrypt({
      encrypted: TEST_ENCRYPTED,
      sharedKey: TEST_SHARED_KEY,
    });
    chai.expect(decrypted).to.eql(TEST_MESSAGE);
  });
});
