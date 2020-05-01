import * as encodingUtils from "../src/encoding";

const TEST_NUMBER = 33232704654549;
const TEST_UTF8 = "wallet";
const TEST_HEX = "0x77616c6c6574636f6e6e656374";
const TEST_BUFFER = Buffer.from(TEST_UTF8, "utf8");
const TEST_ARRAY_BUFFER = new Uint8Array(TEST_BUFFER).buffer;

const TEST_NUMBER_2 = 16;
const TEST_HEX_2 = "0x10";
const TEST_UTF8_2 = `${TEST_NUMBER_2}`;
const TEST_BUFFER_2 = Buffer.from(TEST_HEX_2, "hex");
const TEST_ARRAY_BUFFER_2 = new Uint8Array(TEST_BUFFER_2).buffer;

describe("Encoding Utils", () => {
  // -- ArrayBuffer ------------------------------------------ //

  it("convertArrayBufferToBuffer", async () => {
    const input = TEST_ARRAY_BUFFER;
    const expected = TEST_BUFFER;
    const result = encodingUtils.convertArrayBufferToBuffer(input);
    // eslint-disable-next-line no-console
    console.log("[convertArrayBufferToBuffer]", "result", result);
    expect(result).toEqual(expected);
  });

  it("convertArrayBufferToUtf8", async () => {
    const input = TEST_ARRAY_BUFFER;
    const expected = TEST_UTF8;
    const result = encodingUtils.convertArrayBufferToUtf8(input);
    // eslint-disable-next-line no-console
    console.log("[convertArrayBufferToUtf8]", "result", result);
    expect(result).toEqual(expected);
  });

  it("convertArrayBufferToHex", async () => {
    const input = TEST_ARRAY_BUFFER;
    const expected = TEST_HEX;
    const result = encodingUtils.convertArrayBufferToHex(input);
    // eslint-disable-next-line no-console
    console.log("[convertArrayBufferToHex]", "result", result);
    expect(result).toEqual(expected);
  });

  it("convertArrayBufferToNumber", async () => {
    const input = TEST_ARRAY_BUFFER;
    const expected = TEST_NUMBER;
    const result = encodingUtils.convertArrayBufferToNumber(input);
    // eslint-disable-next-line no-console
    console.log("[convertArrayBufferToNumber]", "result", result);
    expect(result).toEqual(expected);
  });

  it("concatArrayBuffers", async () => {
    const input = [TEST_ARRAY_BUFFER, TEST_ARRAY_BUFFER];
    const expected = new Uint8Array(Buffer.concat([TEST_BUFFER, TEST_BUFFER])).buffer;
    const result = encodingUtils.concatArrayBuffers(...input);
    // eslint-disable-next-line no-console
    console.log("[concatArrayBuffers]", "result", result);
    expect(result).toEqual(expected);
  });

  // -- Buffer ----------------------------------------------- //

  it("convertBufferToArrayBuffer", async () => {
    const input = TEST_BUFFER;
    const expected = TEST_ARRAY_BUFFER;
    const result = encodingUtils.convertBufferToArrayBuffer(input);
    // eslint-disable-next-line no-console
    console.log("[convertBufferToArrayBuffer]", "result", result.toString());
    expect(result).toEqual(expected);
  });

  it("convertBufferToUtf8", async () => {
    const input = TEST_BUFFER;
    const expected = TEST_UTF8;
    const result = encodingUtils.convertBufferToUtf8(input);
    // eslint-disable-next-line no-console
    console.log("[convertBufferToUtf8]", "result", result);
    expect(result).toEqual(expected);
  });

  it("convertBufferToHex", async () => {
    const input = TEST_BUFFER;
    const expected = TEST_HEX;
    const result = encodingUtils.convertBufferToHex(input);
    // eslint-disable-next-line no-console
    console.log("[convertBufferToHex]", "result", result);
    expect(result).toEqual(expected);
  });

  it("convertBufferToNumber", async () => {
    const input = TEST_BUFFER;
    const expected = TEST_NUMBER;
    const result = encodingUtils.convertBufferToNumber(input);
    // eslint-disable-next-line no-console
    console.log("[convertBufferToNumber]", "result", result);
    expect(result).toEqual(expected);
  });

  it("concatBuffers", async () => {
    const input = [TEST_BUFFER, TEST_BUFFER];
    const expected = Buffer.concat(input);
    const result = encodingUtils.concatBuffers(...input);
    // eslint-disable-next-line no-console
    console.log("[encodingUtils]", "result", result);
    expect(result).toEqual(expected);
  });

  // -- Utf8 ------------------------------------------------- //

  it("convertUtf8ToArrayBuffer", async () => {
    const input = TEST_UTF8;
    const expected = TEST_ARRAY_BUFFER;
    const result = encodingUtils.convertUtf8ToArrayBuffer(input);
    // eslint-disable-next-line no-console
    console.log("[convertUtf8ToArrayBuffer]", "result", result.toString());
    expect(result).toEqual(expected);
  });

  it("convertUtf8ToBuffer", async () => {
    const input = TEST_UTF8;
    const expected = TEST_BUFFER;
    const result = encodingUtils.convertUtf8ToBuffer(input);
    // eslint-disable-next-line no-console
    console.log("[convertUtf8ToBuffer]", "result", result);
    expect(result).toEqual(expected);
  });

  it("convertUtf8ToHex", async () => {
    const input = TEST_UTF8;
    const expected = TEST_HEX;
    const result = encodingUtils.convertUtf8ToHex(input);
    // eslint-disable-next-line no-console
    console.log("[convertUtf8ToHex]", "result", result);
    expect(result).toEqual(expected);
  });

  it("convertUtf8ToNumber", async () => {
    const input = TEST_UTF8;
    const expected = TEST_NUMBER;
    const result = encodingUtils.convertUtf8ToNumber(input);
    // eslint-disable-next-line no-console
    console.log("[convertUtf8ToNumber]", "result", result);
    expect(result).toEqual(expected);
  });

  // -- Hex -------------------------------------------------- //

  it("convertHexToBuffer", async () => {
    const input = TEST_HEX;
    const expected = TEST_BUFFER;
    const result = encodingUtils.convertHexToBuffer(input);
    // eslint-disable-next-line no-console
    console.log("[convertHexToBuffer]", "result", result);
    expect(result).toEqual(expected);
  });

  it("convertHexToArrayBuffer", async () => {
    const input = TEST_HEX;
    const expected = TEST_ARRAY_BUFFER;
    const result = encodingUtils.convertHexToArrayBuffer(input);
    // eslint-disable-next-line no-console
    console.log("[convertHexToArrayBuffer]", "result", result.toString());
    expect(result).toEqual(expected);
  });

  it("convertHexToUtf8", async () => {
    const input = TEST_HEX;
    const expected = TEST_HEX;
    const result = encodingUtils.convertHexToUtf8(input);
    // eslint-disable-next-line no-console
    console.log("[convertHexToUtf8]", "result", result);
    expect(result).toEqual(expected);
  });

  it("convertHexToNumber", async () => {
    const input = TEST_HEX;
    const expected = TEST_NUMBER;
    const result = encodingUtils.convertHexToNumber(input);
    // eslint-disable-next-line no-console
    console.log("[convertHexToNumber]", "result", result);
    expect(result).toEqual(expected);
  });

  // -- Number ----------------------------------------------- //

  it("convertNumberToBuffer", async () => {
    const input = TEST_NUMBER_2;
    const expected = TEST_BUFFER_2;
    const result = encodingUtils.convertNumberToBuffer(input);
    // eslint-disable-next-line no-console
    console.log("[convertNumberToBuffer]", "result", result);
    expect(result).toEqual(expected);
  });

  it("convertNumberToArrayBuffer", async () => {
    const input = TEST_NUMBER_2;
    const expected = TEST_ARRAY_BUFFER_2;
    const result = encodingUtils.convertNumberToArrayBuffer(input);
    // eslint-disable-next-line no-console
    console.log("[convertNumberToArrayBuffer]", "result", result.toString());
    expect(result).toEqual(expected);
  });

  it("convertNumberToUtf8", async () => {
    const input = TEST_NUMBER_2;
    const expected = TEST_UTF8_2;
    const result = encodingUtils.convertNumberToUtf8(input);
    // eslint-disable-next-line no-console
    console.log("[convertNumberToUtf8]", "result", result);
    expect(result).toEqual(expected);
  });

  it("convertNumberToHex", async () => {
    const input = TEST_NUMBER_2;
    const expected = TEST_HEX_2;
    const result = encodingUtils.convertNumberToHex(input);
    // eslint-disable-next-line no-console
    console.log("[convertNumberToHex]", "result", result);
    expect(result).toEqual(expected);
  });
});
