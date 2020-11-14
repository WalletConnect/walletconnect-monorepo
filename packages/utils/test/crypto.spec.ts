import "mocha";
import * as chai from "chai";
import * as eccies25519 from "ecies-25519";
import * as encUtils from "enc-utils";
import { safeJsonStringify } from "safe-json-utils";

import { deriveSharedKey, encrypt, sha256, decrypt } from "../src";

const TEST_KEY_PAIRS = {
  A: {
    privateKey: "ab2b20f4dee812763a65099347d3206d1b7426cd11866cc5f9e4b05bafee8013",
    publicKey: "293ad39c56f6023add9353ac2770edc12f1571f0c2978bfe8891e3f4a23f9344",
  },
  B: {
    privateKey: "a9bb5cc5fbd8aebae4ef7f4a199234ac0c8f4655038c6e66432ce0f014e2223f",
    publicKey: "cd01c94ff24526db8705e6fc867b66d02604e8098200d6681d7a394b1b53a30b",
  },
};

const TEST_SHARED_KEY = "262d750e6b241bb6b54e1415b9f4eda2ae8bf2fad263a50470c632ca468b894d";
const TEST_HASHED_KEY = "9a60d102d6fc8bee489d5df7d2744a5074a5768802305530dcaed242b5891e78";

const TEST_MESSAGE = safeJsonStringify({
  id: 1,
  jsonrpc: "2.0",
  method: "test_method",
  params: {},
});
const TEST_SELF = TEST_KEY_PAIRS["A"];
const TEST_IV = "8fb4967a2016f48e19b9c64529c3fcfc";
const TEST_PEER = TEST_KEY_PAIRS["B"];
const TEST_MAC = "9a12a979f6dce67d4923dea85340d5a3e06661a15231f4dee3231b4ae37599d8";
const TEST_CIPHERTEXT =
  "fd69d140adb0a352c90a49ec2d7cf7207ae56416eb344c3bd98d8c757f7afadf40e1ce7762f2b31979e5b3dcaa0229c76f15adb896da32293f4c7d2573dbeadc";
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
      self: TEST_SELF,
      peer: TEST_PEER,
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
      self: TEST_SELF,
    });
    chai.expect(decrypted).to.eql(TEST_MESSAGE);
  });
});
