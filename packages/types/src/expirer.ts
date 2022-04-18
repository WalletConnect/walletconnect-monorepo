import { Logger } from "pino";
import { IEvents } from "@walletconnect/events";

import { IClient } from "./client";

export declare namespace ExpirerTypes {
  interface Expiration {
    topic: string;
    expiry: number;
  }

  interface Created {
    topic: string;
    expiration: Expiration;
  }

  interface Deleted {
    topic: string;
    expiration: Expiration;
  }

  interface Expired {
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

  public abstract set(tag: string, expiration: ExpirerTypes.Expiration): Promise<void>;

  public abstract get(tag: string): Promise<ExpirerTypes.Expiration>;

  public abstract del(tag: string): Promise<void>;
}
