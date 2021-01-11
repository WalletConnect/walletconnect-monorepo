import "mocha";
import os from "os";
import { expect } from "chai";

import { getPairingType, getPairingMetadata, getSessionMetadata } from "../src";

describe("Metadata", () => {
  it("getPairingType", () => {
    expect(getPairingType("react-native")).to.eql("mobile");
    expect(getPairingType("browser")).to.eql("browser");
    expect(getPairingType("node")).to.eql("desktop");
    expect(getPairingType("unknown")).to.eql("");
  });
  it("getPairingMetadata", () => {
    const metadata = getPairingMetadata();
    expect(typeof metadata === "undefined").to.be.false;
    if (typeof metadata === "undefined") return;
    expect(metadata.type).to.eql("desktop");
    expect(metadata.platform).to.eql("node");
    expect(metadata.version).to.eql(process.version.replace("v", ""));
    expect(metadata.os).to.eql(os.platform().toLowerCase());
  });
  it("getSessionMetadata", () => {
    const metadata = getSessionMetadata();
    expect(typeof metadata === "undefined").to.be.true;
  });
});
