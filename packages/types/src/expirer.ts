import { Logger } from "pino";
import { IEvents } from "@walletconnect/jsonrpc-types";

import { IClient } from "./client";

export abstract class IExpirer extends IEvents {
  public abstract name: string;
  public abstract readonly context: string;

  constructor(public client: IClient, public logger: Logger) {
    super();
  }

  public abstract init(): Promise<void>;

  public abstract has(tag: string): Promise<boolean>;

  public abstract set(tag: string, expiry: number): Promise<void>;

  public abstract get(tag: string): Promise<number>;

  public abstract del(tag: string): Promise<void>;
}
