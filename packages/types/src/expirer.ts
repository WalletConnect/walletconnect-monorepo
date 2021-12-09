import { Logger } from "pino";
import { IEvents } from "@walletconnect/jsonrpc-types";

import { IClient } from "./client";

export interface Expiration {
  topic: string;
  expiry: number;
}

export declare namespace ExpirerEvents {
  export interface Created {
    topic: string;
    expiration: Expiration;
  }

  export interface Deleted {
    topic: string;
    expiration: Expiration;
  }

  export interface Expired {
    topic: string;
    expiration: Expiration;
  }
}

export abstract class IExpirer extends IEvents {
  public abstract name: string;
  public abstract readonly context: string;

  constructor(public client: IClient, public logger: Logger) {
    super();
  }

  public abstract init(): Promise<void>;

  public abstract has(tag: string): Promise<boolean>;

  public abstract set(tag: string, expiration: Expiration): Promise<void>;

  public abstract get(tag: string): Promise<Expiration>;

  public abstract del(tag: string): Promise<void>;
}
