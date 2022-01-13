import { IridiumV1Message, IridiumV1MessageOptions } from "./types";
import { decodeIridiumV1Message, encodeIridiumV1Message } from "./utils";

export class IridiumEncoder {
  private version = 1;

  public async encode(msg: string, opts?: IridiumV1MessageOptions): Promise<string> {
    return encodeIridiumV1Message(this.version, msg, opts);
  }

  public async decode(hex: string): Promise<IridiumV1Message> {
    return decodeIridiumV1Message(this.version, hex);
  }
}
