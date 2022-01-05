import { Logger } from "pino";
import { IEvents } from "@walletconnect/jsonrpc-types";

export interface HeartBeatOptions {
  logger?: string | Logger;
  interval?: number;
}

export abstract class IHeartBeat extends IEvents {
  public abstract name: string;
  public abstract readonly context: string;

  public abstract logger: Logger;

  public abstract interval: number;

  constructor(opts?: HeartBeatOptions) {
    super();
  }

  public abstract init(): Promise<void>;
}
