import "mocha";
import * as chai from "chai";
import { UriParameters } from "@walletconnect/types";
import { safeJsonStringify } from "safe-json-utils";

import { formatUri, parseUri } from "../src";

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

describe("URI", () => {
  it("formatUri", () => {
    const uri = formatUri(TEST_URI_PARAMS);
    chai.expect(uri).to.eql(TEST_URI_STRING);
  });
  it("parseUri", () => {
    const uriParams = parseUri(TEST_URI_STRING);
    chai.expect(uriParams.protocol).to.eql(TEST_URI_PARAMS.protocol);
    chai.expect(uriParams.version).to.eql(TEST_URI_PARAMS.version);
    chai.expect(uriParams.topic).to.eql(TEST_URI_PARAMS.topic);
    chai.expect(uriParams.publicKey).to.eql(TEST_URI_PARAMS.publicKey);
    chai.expect(uriParams.relay).to.eql(TEST_URI_PARAMS.relay);
  });
});
