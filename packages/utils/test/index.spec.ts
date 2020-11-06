import { UriParameters } from "@walletconnect/types";
import { safeJsonStringify } from "safe-json-utils";

import { deriveSharedKey, encrypt, formatUri, parseUri, sha256, generateKeyPair } from "../src";

const TEST_URI_PARAMS: UriParameters = {
  protocol: "wc",
  version: 2,
  topic: "c9e6d30fb34afe70a15c14e9337ba8e4d5a35dd695c39b94884b0ee60c69d168",
  publicKey: "03b8bab4d10634ed82e2b358f7ba01704ec9e0f139d7fe1db694ecfbfd8bb4b57f",
  relay: {
    protocol: "bridge",
    params: {},
  },
};

const TEST_URI_STRING = `${TEST_URI_PARAMS.protocol}:${TEST_URI_PARAMS.topic}@${
  TEST_URI_PARAMS.version
}?publicKey=${TEST_URI_PARAMS.publicKey}&relay=${encodeURIComponent(
  safeJsonStringify(TEST_URI_PARAMS.relay),
)}`;

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

const TEST_SHARED_KEY = "a321c72f45b1332dffac838220b09f85456c9cb038b1cefc9abf16ed68a38e34";
const TEST_HASHED_KEY = "9f50f79f4a5113f3e6ebd32dd80b092ec0a8114f034fbfc76c103883d984f188";

// const TEST_MESSAGE = safeJsonStringify({
//   id: 1,
//   jsonrpc: "2.0",
//   method: "test_method",
//   params: {},
// });
// const TEST_ENCRYPTED =
//   "642f78903cc81abd0b0e33f9bb406371f0d44e645357ecda42429d399f5e55cc213cf898dd890a690b3ce6f24be4ac82a958286a5d48d412f9a95845bd68589e4e1e50d0d1434a952788b35e6f713e7c3ee4018c276b9e951855ccd871e666ff9a52c44ac1c1a0eb9306d176531f4945";

describe("URI", () => {
  it("formatUri", () => {
    const uri = formatUri(TEST_URI_PARAMS);
    expect(uri).toEqual(TEST_URI_STRING);
  });
  it("parseUri", () => {
    const uriParams = parseUri(TEST_URI_STRING);
    expect(uriParams.protocol).toEqual(TEST_URI_PARAMS.protocol);
    expect(uriParams.version).toEqual(TEST_URI_PARAMS.version);
    expect(uriParams.topic).toEqual(TEST_URI_PARAMS.topic);
    expect(uriParams.publicKey).toEqual(TEST_URI_PARAMS.publicKey);
    expect(uriParams.relay).toEqual(TEST_URI_PARAMS.relay);
  });
});

describe("Crypto", () => {
  it("deriveSharedKey", async () => {
    const sharedKey = deriveSharedKey(
      TEST_KEY_PAIRS["A"].privateKey,
      TEST_KEY_PAIRS["B"].publicKey,
    );
    expect(sharedKey).toEqual(TEST_SHARED_KEY);
  });
  it("sha256", async () => {
    const hash = await sha256(TEST_SHARED_KEY);
    expect(hash).toEqual(TEST_HASHED_KEY);
  });
  // it("encrypt", async () => {
  //   const encrypted = await encrypt({
  //     message: TEST_MESSAGE,
  //     sharedKey: TEST_SHARED_KEY,
  //     publicKey: TEST_KEY_PAIRS["A"].publicKey,
  //   });
  //   expect(encrypted).toEqual(TEST_ENCRYPTED);
  // });
});
