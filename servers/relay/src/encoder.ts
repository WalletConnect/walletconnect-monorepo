import { IridiumV1Message, IridiumV1MessageOptions } from "./types";
import {
  checkIridiumMessageVersion,
  decodeIridiumV1Message,
  encodeIridiumV1Message,
} from "./utils";

export class IridiumEncoder {
  public async check(msg: string): Promise<number> {
    return checkIridiumMessageVersion(msg);
  }

  public async encode(msg: string, opts?: IridiumV1MessageOptions): Promise<string> {
    return encodeIridiumV1Message(msg, opts);
  }

  public async decode(hex: string): Promise<IridiumV1Message> {
    const version = await this.check(hex);
    switch (version) {
      case 0:
        return { version: 0, message: hex, opts: { prompt: false } };
      case 1:
        return decodeIridiumV1Message(hex, version);
      default:
        throw new Error(`Unknown Iridium message version: ${version}`);
    }
  }
}
