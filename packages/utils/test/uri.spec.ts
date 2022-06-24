import { EngineTypes } from "@walletconnect/types";
import { expect, describe, it } from "vitest";
import { formatUri, parseUri } from "../src";
import { TEST_PAIRING_TOPIC, TEST_RELAY_OPTIONS, TEST_SYM_KEY } from "./shared";

const TEST_URI_PARAMS: EngineTypes.UriParameters = {
  protocol: "wc",
  version: 2,
  topic: TEST_PAIRING_TOPIC,
  symKey: TEST_SYM_KEY,
  relay: TEST_RELAY_OPTIONS,
};

const TEST_URI_STRING = `${TEST_URI_PARAMS.protocol}:${TEST_URI_PARAMS.topic}@${TEST_URI_PARAMS.version}?relay-protocol=${TEST_RELAY_OPTIONS.protocol}&symKey=${TEST_URI_PARAMS.symKey}`;

describe("URI", () => {
  it("formatUri", () => {
    const uri = formatUri(TEST_URI_PARAMS);
    expect(uri).to.eql(TEST_URI_STRING);
  });
  it("parseUri", () => {
    const uriParams = parseUri(TEST_URI_STRING);
    expect(uriParams.version).to.eql(TEST_URI_PARAMS.version);
    expect(uriParams.topic).to.eql(TEST_URI_PARAMS.topic);
    expect(uriParams.symKey).to.eql(TEST_URI_PARAMS.symKey);
    expect(uriParams.relay.data).to.eql(TEST_URI_PARAMS.relay.data);
    expect(uriParams.relay.protocol).to.eql(TEST_URI_PARAMS.relay.protocol);
  });
});
