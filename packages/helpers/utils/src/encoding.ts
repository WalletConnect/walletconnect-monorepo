import BN from "bn.js";
import { hexlify, arrayify } from "@ethersproject/bytes";
import { toUtf8Bytes, toUtf8String } from "@ethersproject/strings";

import { removeHexPrefix, addHexPrefix, sanitizeHex } from "./misc";

// -- ArrayBuffer ------------------------------------------ //

export function convertArrayBufferToBuffer(arrayBuffer: ArrayBuffer): Buffer {
  const hex = convertArrayBufferToHex(arrayBuffer);
  const result = convertHexToBuffer(hex);
  return result;
}

export function convertArrayBufferToUtf8(arrayBuffer: ArrayBuffer): string {
  const utf8 = toUtf8String(new Uint8Array(arrayBuffer));
  return utf8;
}

export function convertArrayBufferToHex(arrayBuffer: ArrayBuffer, noPrefix?: boolean): string {
  let hex = hexlify(new Uint8Array(arrayBuffer));
  if (noPrefix) {
    hex = removeHexPrefix(hex);
  }
  return hex;
}

export function convertArrayBufferToNumber(arrayBuffer: ArrayBuffer): number {
  const hex = convertArrayBufferToHex(arrayBuffer);
  const num = convertHexToNumber(hex);
  return num;
}

export function concatArrayBuffers(...args: ArrayBuffer[]): ArrayBuffer {
  const hex: string = args.map(b => convertArrayBufferToHex(b, true)).join("");
  const result: ArrayBuffer = convertHexToArrayBuffer(hex);
  return result;
}

// -- Buffer ----------------------------------------------- //

export function convertBufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  const hex = convertBufferToHex(buffer);
  const result = convertHexToArrayBuffer(hex);
  return result;
}

export function convertBufferToUtf8(buffer: Buffer): string {
  const result = buffer.toString("utf8");
  return result;
}

export function convertBufferToHex(buffer: Buffer, noPrefix?: boolean): string {
  let hex = buffer.toString("hex");
  if (!noPrefix) {
    hex = addHexPrefix(hex);
  }
  return hex;
}

export function convertBufferToNumber(buffer: Buffer): number {
  const hex = convertBufferToHex(buffer);
  const num = convertHexToNumber(hex);
  return num;
}

export function concatBuffers(...args: Buffer[]): Buffer {
  const result = Buffer.concat(args);
  return result;
}

// -- Utf8 ------------------------------------------------- //

export function convertUtf8ToArrayBuffer(utf8: string): ArrayBuffer {
  const arrayBuffer = toUtf8Bytes(utf8).buffer;
  return arrayBuffer;
}

export function convertUtf8ToBuffer(utf8: string): Buffer {
  const result = Buffer.from(utf8, "utf8");
  return result;
}

export function convertUtf8ToHex(utf8: string, noPrefix?: boolean): string {
  const arrayBuffer = convertUtf8ToArrayBuffer(utf8);
  const hex = convertArrayBufferToHex(arrayBuffer, noPrefix);
  return hex;
}

export function convertUtf8ToNumber(utf8: string): number {
  const num = new BN(utf8).toNumber();
  return num;
}

// -- Number ----------------------------------------------- //

export function convertNumberToBuffer(num: number): Buffer {
  const hex = convertNumberToHex(num);
  const buffer = convertHexToBuffer(hex);
  return buffer;
}

export function convertNumberToArrayBuffer(num: number): ArrayBuffer {
  const hex = convertNumberToHex(num);
  const arrayBuffer = convertHexToArrayBuffer(hex);
  return arrayBuffer;
}

export function convertNumberToUtf8(num: number): string {
  const utf8 = new BN(num).toString();
  return utf8;
}

export function convertNumberToHex(num: number | string, noPrefix?: boolean): string {
  let hex = new BN(num).toString(16);
  hex = sanitizeHex(hex);
  if (noPrefix) {
    hex = removeHexPrefix(hex);
  }
  return hex;
}

// -- Hex -------------------------------------------------- //

export function convertHexToBuffer(hex: string): Buffer {
  hex = removeHexPrefix(hex);
  const buffer = Buffer.from(hex, "hex");
  return buffer;
}

export function convertHexToArrayBuffer(hex: string): ArrayBuffer {
  hex = addHexPrefix(hex);
  const arrayBuffer = arrayify(hex).buffer;
  return arrayBuffer;
}

export function convertHexToUtf8(hex: string): string {
  const arrayBuffer = convertHexToArrayBuffer(hex);
  const utf8 = convertArrayBufferToUtf8(arrayBuffer);
  return utf8;
}

export function convertHexToNumber(hex: string): number {
  const num = new BN(hex, "hex").toNumber();
  return num;
}
