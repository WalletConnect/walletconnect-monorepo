import "mocha";
import { expect } from "chai";

import { IJsonRpcRequest, IEncryptionPayload } from "@walletconnect/types";
import { convertHexToArrayBuffer } from "@walletconnect/utils";

import * as IsoCrypto from "../src";

const TEST_JSON_RPC_REQUEST: IJsonRpcRequest = {
  id: 1,
  jsonrpc: "2.0",
  method: "wc_test",
  params: [],
};
const TEST_KEY = "2254c5145902fe280fb035e98bea896e024b78ccab33a62a38f538c860d60339";
const TEST_IV = "81413061def750d1a8f857d98d66584d";
const TEST_ENCRYPTION_PAYLOAD: IEncryptionPayload = {
  data:
    "170ac2b0c8ba61ac268455c42eb72c452e23888c6b357bcfc1b8c4c12770690c714e2171ceee0fa4aa639bcbfb9c6b111cbad0f73759c782253a3b4c0da1c43e",
  hmac: "f779131fb8976435eb6984c23f597ffdf2f2a7122543d27907774c0f92142d33",
  iv: "81413061def750d1a8f857d98d66584d",
};

describe("IsoCrypto", () => {
  it("encrypt successfully", async () => {
    const request = TEST_JSON_RPC_REQUEST;
    const key = convertHexToArrayBuffer(TEST_KEY);
    const iv = convertHexToArrayBuffer(TEST_IV);
    const result = await IsoCrypto.encrypt(request, key, iv);
    expect(!!result).to.be.true;
    if (!result) return;
    expect(result.data).to.eql(TEST_ENCRYPTION_PAYLOAD.data);
    expect(result.hmac).to.eql(TEST_ENCRYPTION_PAYLOAD.hmac);
    expect(result.iv).to.eql(TEST_ENCRYPTION_PAYLOAD.iv);
  });

  it("decrypt successfully", async () => {
    const payload = TEST_ENCRYPTION_PAYLOAD;
    const key = convertHexToArrayBuffer(TEST_KEY);
    const result = await IsoCrypto.decrypt(payload, key);
    expect(!!result).to.be.true;
    if (!result) return;
    expect((result as IJsonRpcRequest).id).to.eql(TEST_JSON_RPC_REQUEST.id);
    expect((result as IJsonRpcRequest).jsonrpc).to.eql(TEST_JSON_RPC_REQUEST.jsonrpc);
    expect((result as IJsonRpcRequest).method).to.eql(TEST_JSON_RPC_REQUEST.method);
    expect((result as IJsonRpcRequest).params).to.eql(TEST_JSON_RPC_REQUEST.params);
  });
});
