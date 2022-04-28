import "mocha";
import { expect } from "chai";

import * as encoding from "@walletconnect/encoding";
import { IridiumEncoder } from "../src/encoder";

const encoder = new IridiumEncoder();
describe("IRIDIUM", () => {
  it("Decode Test", async () => {
    let payload = "1";
    const encoded = await encoder.encode(payload);
    const {
      message,
      opts: { prompt },
    } = await encoder.decode(encoded);
    expect(message).to.equal(payload);
    expect(prompt).to.be.false;
  });
  it("Decode Test", async () => {
    let payload = "4b7e34e9c9ae95fc421a138f205de4d670e68ad93accf5a7fefa0af1a761c2b1".repeat(2);
    const encoded = await encoder.encode(payload);
    const {
      message,
      opts: { prompt },
    } = await encoder.decode(encoded);
    expect(message).to.equal(payload);
    expect(prompt).to.be.false;
  });
  it("Decode Test", async () => {
    const encoder = new IridiumEncoder();
    let payload = "4b".repeat(4);
    const encoded = await encoder.encode(payload);
    const {
      message,
      opts: { prompt },
    } = await encoder.decode(encoded);
    expect(message).to.equal(payload);
    expect(prompt).to.be.false;
  });
});
