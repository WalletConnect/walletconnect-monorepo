import "mocha";
import { expect } from "chai";
import * as eccies25519 from "@walletconnect/ecies-25519";
import * as encoding from "@walletconnect/encoding";
import { safeJsonStringify } from "@walletconnect/safe-json";

import { deriveSharedKey, encrypt, sha256, decrypt } from "../src";

import { TEST_HASHED_KEY, TEST_KEY_PAIRS, TEST_SHARED_KEY } from "./shared";

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
    expect(sharedKey).to.eql(TEST_SHARED_KEY);
  });
  it("sha256", async () => {
    const hash = await sha256(TEST_SHARED_KEY);
    expect(hash).to.eql(TEST_HASHED_KEY);
  });
  it("encrypt", async () => {
    const encrypted = await encrypt({
      iv: TEST_IV,
      message: TEST_MESSAGE,
      sharedKey: TEST_SHARED_KEY,
      publicKey: TEST_SELF.publicKey,
    });
    const deserialized = eccies25519.deserialize(encoding.hexToArray(encrypted));
    const iv = encoding.arrayToHex(deserialized.iv);
    expect(iv).to.eql(TEST_IV);
    const publicKey = encoding.arrayToHex(deserialized.publicKey);
    expect(publicKey).to.eql(TEST_SELF.publicKey);
    const mac = encoding.arrayToHex(deserialized.mac);
    expect(mac).to.eql(TEST_MAC);
    const ciphertext = encoding.arrayToHex(deserialized.ciphertext);
    expect(ciphertext).to.eql(TEST_CIPHERTEXT);
  });
  it("decrypt", async () => {
    const decrypted = await decrypt({
      encrypted: TEST_ENCRYPTED,
      sharedKey: TEST_SHARED_KEY,
    });
    expect(decrypted).to.eql(TEST_MESSAGE);
  });
});
