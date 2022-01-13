import * as encoding from "@walletconnect/encoding";
import { IRIDIUM_MESSAGE_PREFIX } from "../constants";

import { IridiumV1Message, IridiumV1MessageOptions } from "../types";

export function checkIridiumMessageVersion(hex: string): number {
  if (!hex.startsWith(IRIDIUM_MESSAGE_PREFIX)) {
    return 0;
  } else {
    const encoded = encoding.hexToArray(hex);
    const version = encoding.arrayToNumber(encoded.slice(2, 3));
    return version;
  }
}

export function encodeIridiumV1Message(v: number, msg: string, opts?: IridiumV1MessageOptions) {
  const prefix = encoding.hexToArray(IRIDIUM_MESSAGE_PREFIX);
  const version = encoding.numberToArray(v);
  const message = encoding.utf8ToArray(msg);
  const length = encoding.numberToArray(message.length);
  const prompt = encoding.numberToArray(opts?.prompt ? 1 : 0);
  return encoding.arrayToHex(encoding.concatArrays(prefix, version, length, message, prompt));
}

export function decodeIridiumV1Message(v: number, hex: string): IridiumV1Message {
  if (!hex.startsWith(IRIDIUM_MESSAGE_PREFIX)) {
    throw new Error(`Cannot decode Iridum message with missing prefix`);
  }
  const encoded = encoding.hexToArray(hex);
  const version = encoding.arrayToNumber(encoded.slice(2, 3));
  if (version !== v) {
    throw new Error(`Cannot decode Iridum message with version: ${version}`);
  }
  const length = encoding.arrayToNumber(encoded.slice(3, 4));
  const message = encoding.arrayToUtf8(encoded.slice(4, length));
  const prompt = encoding.arrayToNumber(encoded.slice(length, length + 1));
  return {
    version,
    message,
    length,
    opts: { prompt: prompt === 1 },
  };
}
