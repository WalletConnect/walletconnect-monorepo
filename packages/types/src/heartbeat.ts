import { Logger } from "pino";
import { IEvents } from "@walletconnect/jsonrpc-types";

export abstract class IHeartBeat extends IEvents {
  public abstract name: string;
  public abstract readonly context: string;

  public abstract interval: number;

  constructor(public logger: Logger, interval?: number) {
    super();
  }

  public abstract init(): Promise<void>;
}
