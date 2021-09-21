import "mocha";
import { expect } from "chai";
import { UriParameters } from "@walletconnect/types";
import { safeJsonStringify } from "@walletconnect/safe-json";

import { formatUri, parseUri } from "../src";
import { TEST_KEY_PAIRS, TEST_PAIRING_TOPIC, TEST_RELAY_OPTIONS } from "./shared";

const TEST_URI_PARAMS: UriParameters = {
  protocol: "wc",
  version: 2,
  topic: TEST_PAIRING_TOPIC,
  publicKey: TEST_KEY_PAIRS["A"].publicKey,
  controller: false,
  relay: TEST_RELAY_OPTIONS,
};

const TEST_URI_STRING = `${TEST_URI_PARAMS.protocol}:${TEST_URI_PARAMS.topic}@${
  TEST_URI_PARAMS.version
}?controller=${TEST_URI_PARAMS.controller}&publicKey=${
  TEST_URI_PARAMS.publicKey
}&relay=${encodeURIComponent(safeJsonStringify(TEST_URI_PARAMS.relay))}`;

describe("URI", () => {
  it("formatUri", () => {
    const uri = formatUri(TEST_URI_PARAMS);
    expect(uri).to.eql(TEST_URI_STRING);
  });
  it("parseUri", () => {
    const uriParams = parseUri(TEST_URI_STRING);
    expect(uriParams.protocol).to.eql(TEST_URI_PARAMS.protocol);
    expect(uriParams.version).to.eql(TEST_URI_PARAMS.version);
    expect(uriParams.topic).to.eql(TEST_URI_PARAMS.topic);
    expect(uriParams.publicKey).to.eql(TEST_URI_PARAMS.publicKey);
    expect(uriParams.controller).to.eql(TEST_URI_PARAMS.controller);
    expect(uriParams.relay).to.eql(TEST_URI_PARAMS.relay);
  });
});
