import { Logger } from "pino";
import { IEvents } from "@walletconnect/events";

import { ICore } from "./core";

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

  constructor(public core: ICore, public logger: Logger) {
    super();
  }

  public abstract init(): Promise<void>;

  public abstract has(tag: string): boolean;

  public abstract set(tag: string, expiration: ExpirerTypes.Expiration): void;

  public abstract get(tag: string): ExpirerTypes.Expiration;

  public abstract del(tag: string): Promise<void>;
}
