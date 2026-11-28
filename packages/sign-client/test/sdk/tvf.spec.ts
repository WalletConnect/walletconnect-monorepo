import { expect, describe, it } from "vitest";
import { Engine } from "../../src/controllers/engine";

// extractTxHashesFromResult needs no client state, so a bare engine is enough
const engine = new Engine({ logger: { warn: () => undefined } } as any) as any;
const extract = (method: string, result: unknown, params: unknown = []) =>
  engine.extractTxHashesFromResult({ method, params }, result);

describe("TVF tx hash extraction", () => {
  it("reports the hash returned by a transaction method", () => {
    const hash = "0x" + "ab".repeat(32);
    expect(extract("eth_sendTransaction", hash)).to.eql([hash]);
  });

  it("never reports the result of a method outside TVF_METHODS", () => {
    const signature = "0x" + "cd".repeat(65);
    expect(extract("personal_sign", signature)).to.eql([]);
    expect(extract("eth_signTypedData_v4", signature)).to.eql([]);
    expect(extract("eth_signTransaction", "0x02f8")).to.eql([]);
    expect(extract("bch_signMessage", "H+base64signature=")).to.eql([]);
    expect(extract("eth_requestAccounts", ["0x" + "11".repeat(20)])).to.eql([]);
  });
});
