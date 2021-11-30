import * as encoding from "@walletconnect/encoding";

// -- ArrayBuffer ------------------------------------------ //

export function convertArrayBufferToBuffer(arrBuf: ArrayBuffer): Buffer {
  return encoding.arrayToBuffer(new Uint8Array(arrBuf));
}

export function convertArrayBufferToUtf8(arrBuf: ArrayBuffer): string {
  return encoding.arrayToUtf8(new Uint8Array(arrBuf));
}

export function convertArrayBufferToHex(arrBuf: ArrayBuffer, noPrefix?: boolean): string {
  return encoding.arrayToHex(new Uint8Array(arrBuf), !noPrefix);
}

export function convertArrayBufferToNumber(arrBuf: ArrayBuffer): number {
  return encoding.arrayToNumber(new Uint8Array(arrBuf));
}

export function concatArrayBuffers(...args: ArrayBuffer[]): ArrayBuffer {
  return encoding.hexToArray(args.map(b => encoding.arrayToHex(new Uint8Array(b))).join("")).buffer;
}

// -- Buffer ----------------------------------------------- //

export function convertBufferToArrayBuffer(buf: Buffer): ArrayBuffer {
  return encoding.bufferToArray(buf).buffer;
}

export function convertBufferToUtf8(buf: Buffer): string {
  return encoding.bufferToUtf8(buf);
}

export function convertBufferToHex(buf: Buffer, noPrefix?: boolean): string {
  return encoding.bufferToHex(buf, !noPrefix);
}

export function convertBufferToNumber(buf: Buffer): number {
  return encoding.bufferToNumber(buf);
}

export function concatBuffers(...args: Buffer[]): Buffer {
  return encoding.concatBuffers(...args);
}

// -- Utf8 ------------------------------------------------- //

export function convertUtf8ToArrayBuffer(utf8: string): ArrayBuffer {
  return encoding.utf8ToArray(utf8).buffer;
}

export function convertUtf8ToBuffer(utf8: string): Buffer {
  return encoding.utf8ToBuffer(utf8);
}

export function convertUtf8ToHex(utf8: string, noPrefix?: boolean): string {
  return encoding.utf8ToHex(utf8, !noPrefix);
}

export function convertUtf8ToNumber(utf8: string): number {
  return encoding.utf8ToNumber(utf8);
}

// -- Hex -------------------------------------------------- //

export function convertHexToBuffer(hex: string): Buffer {
  return encoding.hexToBuffer(hex);
}

export function convertHexToArrayBuffer(hex: string): ArrayBuffer {
  return encoding.hexToArray(hex).buffer;
}

export function convertHexToUtf8(hex: string): string {
  return encoding.hexToUtf8(hex);
}

export function convertHexToNumber(hex: string): number {
  return encoding.hexToNumber(hex);
}

// -- Number ----------------------------------------------- //

export function convertNumberToBuffer(num: number): Buffer {
  return encoding.numberToBuffer(num);
}

export function convertNumberToArrayBuffer(num: number): ArrayBuffer {
  return encoding.numberToArray(num).buffer;
}

export function convertNumberToUtf8(num: number): string {
  return encoding.numberToUtf8(num);
}

export function convertNumberToHex(num: number | string, noPrefix?: boolean): string {
  return encoding.numberToHex(Number(num), !noPrefix);
}
