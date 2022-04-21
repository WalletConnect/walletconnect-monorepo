import * as encoding from "@walletconnect/encoding";
import { IRIDIUM_MESSAGE_PREFIX, IRIDIUM_HEADER } from "../constants";

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
  let length = new Uint8Array(IRIDIUM_HEADER?.["1"].LENGTH_SIZE);
  // Little endian
  encoding.numberToArray(message.length).forEach((val: number, index: number) => {
    length[index] = val
  })
  length.reverse();
  const prompt = encoding.numberToArray(opts?.prompt ? 1 : 0);
  let rawArray = encoding.concatArrays(prefix, version, length, message, prompt);
  return encoding.arrayToHex(rawArray);
}

export function decodeIridiumV1Message(hex: string, v?: number): IridiumV1Message {
  const raw = encoding.hexToArray(hex);
  if (!hasIridiumMessagePrefix(raw)) {
    throw new Error(`Cannot decode Iridum message with missing prefix`);
  }
  const version = getIridiumMessageVersion(raw);
  if (typeof v !== "undefined" && version !== v) {
    throw new Error(`Cannot decode Iridum message with version: ${version}`);
  }
  const {LENGTH_SIZE, TOTAL_SIZE} = IRIDIUM_HEADER["1"]
  const lengthHeaderStart = TOTAL_SIZE - LENGTH_SIZE
  const msgLength = encoding.arrayToNumber(raw.slice(lengthHeaderStart, TOTAL_SIZE));
  const message = encoding.arrayToUtf8(raw.slice(TOTAL_SIZE, msgLength+TOTAL_SIZE));
  const prompt = encoding.arrayToNumber(raw.slice(msgLength+TOTAL_SIZE));
  return {
    version,
    message,
    opts: { prompt: prompt === 1 },
  };
}
