import * as encoding from "@walletconnect/encoding";

import { IridiumV1Message, IridiumV1MessageOptions } from "./types";

export class IridiumEncoder {
  private version = 1;

  public async encode(msg: string, opts?: IridiumV1MessageOptions): Promise<string> {
    const version = encoding.numberToArray(this.version);
    const message = encoding.utf8ToArray(msg);
    const length = encoding.numberToArray(message.length);
    const prompt = encoding.numberToArray(opts?.prompt ? 1 : 0);
    return encoding.arrayToHex(encoding.concatArrays(version, length, message, prompt));
  }

  public async decode(hex: string): Promise<IridiumV1Message> {
    const encoded = encoding.hexToArray(hex);
    const version = encoding.arrayToNumber(encoded.slice(0, 1));
    if (version !== this.version) {
      throw new Error(`Cannot decode Iridum message with version: ${version}`);
    }
    const length = encoding.arrayToNumber(encoded.slice(1, 2));
    const message = encoding.arrayToUtf8(encoded.slice(2, length));
    const prompt = encoding.arrayToNumber(encoded.slice(length, length + 1));
    return {
      version,
      message,
      length,
      opts: { prompt: prompt === 1 },
    };
  }
}
