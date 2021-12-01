import "mocha";
import { expect } from "chai";

import * as encodingUtils from "../src/encoding";
import { removeHexPrefix } from "../src/misc";
import { getType } from "../src/validators";

function compare(a: any, b: any) {
  const type = getType(a);
  if (type !== getType(b)) {
    return false;
  }
  if (type === "array-buffer") {
    a = Buffer.from(a);
    b = Buffer.from(b);
  }
  return a.toString().toLowerCase() === b.toString().toLowerCase();
}

const TEST_STRING_UTF8 = "wallet";
const TEST_STRING_HEX = "0x77616c6c6574";
const TEST_STRING_BUF = Buffer.from(TEST_STRING_UTF8, "utf8");
const TEST_STRING_ARR_BUF = new Uint8Array(TEST_STRING_BUF).buffer;

const TEST_NUMBER_NUM = 16;
const TEST_NUMBER_HEX = "0x10";
const TEST_NUMBER_UTF8 = `${TEST_NUMBER_NUM}`;
const TEST_NUMBER_BUF = Buffer.from(removeHexPrefix(TEST_NUMBER_HEX), "hex");
const TEST_NUMBER_ARR_BUF = new Uint8Array(TEST_NUMBER_BUF).buffer;

describe("Encoding Utils", () => {
  // -- ArrayBuffer ------------------------------------------ //

  it("convertArrayBufferToBuffer", async () => {
    const input = TEST_STRING_ARR_BUF;
    const expected = TEST_STRING_BUF;
    const result = encodingUtils.convertArrayBufferToBuffer(input);
    expect(compare(result, expected)).to.be.true;
  });

  it("convertArrayBufferToUtf8", async () => {
    const input = TEST_STRING_ARR_BUF;
    const expected = TEST_STRING_UTF8;
    const result = encodingUtils.convertArrayBufferToUtf8(input);
    expect(compare(result, expected)).to.be.true;
  });

  it("convertArrayBufferToHex", async () => {
    const input = TEST_STRING_ARR_BUF;
    const expected = TEST_STRING_HEX;
    const result = encodingUtils.convertArrayBufferToHex(input);
    expect(compare(result, expected)).to.be.true;
  });

  it("convertArrayBufferToNumber", async () => {
    const input = TEST_NUMBER_ARR_BUF;
    const expected = TEST_NUMBER_NUM;
    const result = encodingUtils.convertArrayBufferToNumber(input);
    expect(compare(result, expected)).to.be.true;
  });

  it("concatArrayBuffers", async () => {
    const input = [TEST_STRING_ARR_BUF, TEST_STRING_ARR_BUF];
    const expected = new Uint8Array(Buffer.concat([TEST_STRING_BUF, TEST_STRING_BUF])).buffer;
    const result = encodingUtils.concatArrayBuffers(...input);
    expect(compare(result, expected)).to.be.true;
  });

  // -- Buffer ----------------------------------------------- //

  it("convertBufferToArrayBuffer", async () => {
    const input = TEST_STRING_BUF;
    const expected = TEST_STRING_ARR_BUF;
    const result = encodingUtils.convertBufferToArrayBuffer(input);
    expect(compare(result, expected)).to.be.true;
  });

  it("convertBufferToUtf8", async () => {
    const input = TEST_STRING_BUF;
    const expected = TEST_STRING_UTF8;
    const result = encodingUtils.convertBufferToUtf8(input);
    expect(compare(result, expected)).to.be.true;
  });

  it("convertBufferToHex", async () => {
    const input = TEST_STRING_BUF;
    const expected = TEST_STRING_HEX;
    const result = encodingUtils.convertBufferToHex(input);
    expect(compare(result, expected)).to.be.true;
  });

  it("convertBufferToNumber", async () => {
    const input = TEST_NUMBER_BUF;
    const expected = TEST_NUMBER_NUM;
    const result = encodingUtils.convertBufferToNumber(input);
    expect(compare(result, expected)).to.be.true;
  });

  it("concatBuffers", async () => {
    const input = [TEST_STRING_BUF, TEST_STRING_BUF];
    const expected = Buffer.concat(input);
    const result = encodingUtils.concatBuffers(...input);
    expect(compare(result, expected)).to.be.true;
  });

  // -- Utf8 ------------------------------------------------- //

  it("convertUtf8ToArrayBuffer", async () => {
    const input = TEST_STRING_UTF8;
    const expected = TEST_STRING_ARR_BUF;
    const result = encodingUtils.convertUtf8ToArrayBuffer(input);
    expect(compare(result, expected)).to.be.true;
  });

  it("convertUtf8ToBuffer", async () => {
    const input = TEST_STRING_UTF8;
    const expected = TEST_STRING_BUF;
    const result = encodingUtils.convertUtf8ToBuffer(input);
    expect(compare(result, expected)).to.be.true;
  });

  it("convertUtf8ToHex", async () => {
    const input = TEST_STRING_UTF8;
    const expected = TEST_STRING_HEX;
    const result = encodingUtils.convertUtf8ToHex(input);
    expect(compare(result, expected)).to.be.true;
  });

  it("convertUtf8ToNumber", async () => {
    const input = TEST_NUMBER_UTF8;
    const expected = TEST_NUMBER_NUM;
    const result = encodingUtils.convertUtf8ToNumber(input);
    expect(compare(result, expected)).to.be.true;
  });

  // -- Hex -------------------------------------------------- //

  it("convertHexToBuffer", async () => {
    const input = TEST_STRING_HEX;
    const expected = TEST_STRING_BUF;
    const result = encodingUtils.convertHexToBuffer(input);
    expect(compare(result, expected)).to.be.true;
  });

  it("convertHexToArrayBuffer", async () => {
    const input = TEST_STRING_HEX;
    const expected = TEST_STRING_ARR_BUF;
    const result = encodingUtils.convertHexToArrayBuffer(input);
    expect(compare(result, expected)).to.be.true;
  });

  it("convertHexToUtf8", async () => {
    const input = TEST_STRING_HEX;
    const expected = TEST_STRING_UTF8;
    const result = encodingUtils.convertHexToUtf8(input);
    expect(compare(result, expected)).to.be.true;
  });

  it("convertHexToNumber", async () => {
    const input = TEST_NUMBER_HEX;
    const expected = TEST_NUMBER_NUM;
    const result = encodingUtils.convertHexToNumber(input);
    expect(compare(result, expected)).to.be.true;
  });

  // -- Number ----------------------------------------------- //

  it("convertNumberToBuffer", async () => {
    const input = TEST_NUMBER_NUM;
    const expected = TEST_NUMBER_BUF;
    const result = encodingUtils.convertNumberToBuffer(input);
    expect(compare(result, expected)).to.be.true;
  });

  it("convertNumberToArrayBuffer", async () => {
    const input = TEST_NUMBER_NUM;
    const expected = TEST_NUMBER_ARR_BUF;
    const result = encodingUtils.convertNumberToArrayBuffer(input);
    expect(compare(result, expected)).to.be.true;
  });

  it("convertNumberToUtf8", async () => {
    const input = TEST_NUMBER_NUM;
    const expected = TEST_NUMBER_UTF8;
    const result = encodingUtils.convertNumberToUtf8(input);
    expect(compare(result, expected)).to.be.true;
  });

  it("convertNumberToHex", async () => {
    const input = TEST_NUMBER_NUM;
    const expected = TEST_NUMBER_HEX;
    const result = encodingUtils.convertNumberToHex(input);
    expect(compare(result, expected)).to.be.true;
  });
});
