import { NewTypes } from "@walletconnect/types";
import { expect } from "chai";
import "mocha";
import { formatUri, parseUri } from "../src";
import { TEST_PAIRING_TOPIC, TEST_RELAY_OPTIONS, TEST_SYMETRIC_KEY } from "./shared";

const TEST_URI_PARAMS: NewTypes.UriParameters = {
  version: 2,
  topic: TEST_PAIRING_TOPIC,
  symetricKey: TEST_SYMETRIC_KEY,
  relayProtocol: TEST_RELAY_OPTIONS.protocol,
  relayData: TEST_RELAY_OPTIONS.data,
};

const TEST_URI_STRING = `wc:${TEST_URI_PARAMS.topic}@${TEST_URI_PARAMS.version}${TEST_URI_PARAMS.relayProtocol}${TEST_URI_PARAMS.relayData}${TEST_URI_PARAMS.symetricKey}`;

describe("URI", () => {
  it("formatUri", () => {
    const uri = formatUri(TEST_URI_PARAMS);
    expect(uri).to.eql(TEST_URI_STRING);
  });
  it("parseUri", () => {
    const uriParams = parseUri(TEST_URI_STRING);
    expect(uriParams.version).to.eql(TEST_URI_PARAMS.version);
    expect(uriParams.topic).to.eql(TEST_URI_PARAMS.topic);
    expect(uriParams.symetricKey).to.eql(TEST_URI_PARAMS.symetricKey);
    expect(uriParams.relayData).to.eql(TEST_URI_PARAMS.relayData);
    expect(uriParams.relayProtocol).to.eql(TEST_URI_PARAMS.relayProtocol);
  });
});
