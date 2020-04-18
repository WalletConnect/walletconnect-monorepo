import BN from "bn.js";
import * as encUtils from "enc-utils";

import { removeHexPrefix, sanitizeHex } from "./misc";

// -- ArrayBuffer ------------------------------------------ //

export function convertArrayBufferToBuffer(arrBuf: ArrayBuffer): Buffer {
  return encUtils.arrayBufferToBuffer(arrBuf);
}

export function convertArrayBufferToUtf8(arrBuf: ArrayBuffer): string {
  return encUtils.arrayBufferToUtf8(arrBuf);
}

export function convertArrayBufferToHex(arrBuf: ArrayBuffer, noPrefix?: boolean): string {
  return encUtils.arrayBufferToHex(arrBuf, !noPrefix);
}

export function convertArrayBufferToNumber(arrBuf: ArrayBuffer): number {
  const hex = encUtils.arrayBufferToHex(arrBuf);
  return convertHexToNumber(hex);
}

export function concatArrayBuffers(...args: ArrayBuffer[]): ArrayBuffer {
  return encUtils.concatArrayBuffers(...args);
}

// -- Buffer ----------------------------------------------- //

export function convertBufferToArrayBuffer(buf: Buffer): ArrayBuffer {
  return encUtils.bufferToArrayBuffer(buf);
}

export function convertBufferToUtf8(buf: Buffer): string {
  return encUtils.bufferToUtf8(buf);
}

export function convertBufferToHex(buf: Buffer, noPrefix?: boolean): string {
  return encUtils.bufferToHex(buf, !noPrefix);
}

export function convertBufferToNumber(buf: Buffer): number {
  const hex = convertBufferToHex(buf);
  return convertHexToNumber(hex);
}

export function concatBuffers(...args: Buffer[]): Buffer {
  return encUtils.concatBuffers(...args);
}

// -- Utf8 ------------------------------------------------- //

export function convertUtf8ToArrayBuffer(utf8: string): ArrayBuffer {
  return encUtils.utf8ToArrayBuffer(utf8);
}

export function convertUtf8ToBuffer(utf8: string): Buffer {
  return encUtils.utf8ToBuffer(utf8);
}

export function convertUtf8ToHex(utf8: string, noPrefix?: boolean): string {
  return encUtils.utf8ToHex(utf8, !noPrefix);
}

export function convertUtf8ToNumber(utf8: string): number {
  const num = new BN(utf8).toNumber();
  return num;
}

// -- Number ----------------------------------------------- //

export function convertNumberToBuffer(num: number): Buffer {
  const hex = convertNumberToHex(num);
  return encUtils.hexToBuffer(hex);
}

export function convertNumberToArrayBuffer(num: number): ArrayBuffer {
  const hex = convertNumberToHex(num);
  return encUtils.hexToBuffer(hex);
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
  return encUtils.hexToBuffer(hex);
}

export function convertHexToArrayBuffer(hex: string): ArrayBuffer {
  return encUtils.hexToArrayBuffer(hex);
}

export function convertHexToUtf8(hex: string): string {
  return encUtils.hexToUtf8(hex);
}

export function convertHexToNumber(hex: string): number {
  const num = new BN(hex, "hex").toNumber();
  return num;
}
