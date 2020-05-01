// import * as browserCrypto from "../src";
// import { IJsonRpcRequest } from "@walletconnect/types";
// import { mockWebCrypto } from "./mocks";

// const TEST_JSON_RPC_REQUEST: IJsonRpcRequest = {
//   id: 1,
//   jsonrpc: "2.0",
//   method: "wc_test",
//   params: [],
// };

// describe("BrowserCrypto", () => {
//   let key: ArrayBuffer;
//   beforeEach(async () => {
//     mockWebCrypto();
//     key = await browserCrypto.generateKey();
//   });
//   it("should decrypto successfully", async () => {
//     const result = await browserCrypto.encrypt(TEST_JSON_RPC_REQUEST, key);
//     console.log("result", result); // eslint-disable-line no-console
//     expect(result).toBeTruthy();
//     expect(Object.keys(result).length).toEqual(3);
//     expect(result.data).toBeTruthy();
//     expect(result.hmac).toBeTruthy();
//     expect(result.iv).toBeTruthy();
//   });
// });

describe("BrowserCrypto", () => {
  it("needs tests", () => {
    // needs tests
  });
});
