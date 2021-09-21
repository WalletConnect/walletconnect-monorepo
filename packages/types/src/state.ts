import { IEvents } from "@walletconnect/jsonrpc-types";
import { Logger } from "pino";

import { IClient } from "./client";
import { Reason } from "./misc";

export declare namespace StateEvent {
  export interface Created<T> {
    topic: string;
    sequence: T;
  }

  export interface Updated<T> {
    topic: string;
    sequence: T;
    update: Partial<T>;
  }

  export interface Deleted<T> {
    topic: string;
    sequence: T;
    reason: Reason;
  }
}

export abstract class IState<Sequence> extends IEvents {
  public abstract sequences: Map<string, Sequence>;

  public abstract readonly context: string;

  public abstract readonly length: number;

  public abstract readonly topics: string[];

  public abstract readonly values: Sequence[];

  constructor(public client: IClient, public logger: Logger, public name: string) {
    super();
  }

  public abstract init(): Promise<void>;

  public abstract set(topic: string, sequence: Sequence): Promise<void>;

  public abstract get(topic: string): Promise<Sequence>;

  public abstract update(topic: string, update: Partial<Sequence>): Promise<void>;

  public abstract delete(topic: string, reason: Reason): Promise<void>;
}
