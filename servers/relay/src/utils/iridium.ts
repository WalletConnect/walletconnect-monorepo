import * as encoding from "@walletconnect/encoding";
import { IRIDIUM_MESSAGE_PREFIX } from "../constants";

import { IridiumV1Message, IridiumV1MessageOptions } from "../types";

export function hasIridiumMessagePrefix(encoded: Uint8Array): boolean {
  const pLength = IRIDIUM_MESSAGE_PREFIX.length;
  const sliced = encoded.slice(0, pLength);
  return encoding.arrayToHex(sliced) === encoding.arrayToHex(sliced);
}

export function getIridiumMessageVersion(encoded: Uint8Array): number {
  const pLength = IRIDIUM_MESSAGE_PREFIX.length;
  return encoding.arrayToNumber(encoded.slice(pLength, pLength + 1));
}

export function checkIridiumMessageVersion(hex: string): number {
  const encoded = encoding.hexToArray(hex);
  if (!hasIridiumMessagePrefix(encoded)) {
    return 0;
  } else {
    return getIridiumMessageVersion(encoded);
  }
}

export function encodeIridiumV1Message(msg: string, opts?: IridiumV1MessageOptions) {
  const prefix = IRIDIUM_MESSAGE_PREFIX;
  const version = encoding.numberToArray(1);
  const message = encoding.utf8ToArray(msg);
  const length = encoding.numberToArray(message.length);
  const prompt = encoding.numberToArray(opts?.prompt ? 1 : 0);
  return encoding.arrayToHex(encoding.concatArrays(prefix, version, length, message, prompt));
}

export function decodeIridiumV1Message(hex: string, v?: number): IridiumV1Message {
  const encoded = encoding.hexToArray(hex);
  if (!hasIridiumMessagePrefix(encoded)) {
    throw new Error(`Cannot decode Iridum message with missing prefix`);
  }
  const version = getIridiumMessageVersion(encoded);
  if (typeof v !== "undefined" && version !== v) {
    throw new Error(`Cannot decode Iridum message with version: ${version}`);
  }
  const length = encoding.arrayToNumber(encoded.slice(4, 5));
  const message = encoding.arrayToUtf8(encoded.slice(5, length));
  const prompt = encoding.arrayToNumber(encoded.slice(length, length + 1));
  return {
    version,
    message,
    opts: { prompt: prompt === 1 },
  };
}
