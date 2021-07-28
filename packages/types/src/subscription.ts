import { JsonRpcPayload, IEvents } from "@walletconnect/jsonrpc-types";
import { Logger } from "pino";

import { IClient } from "./client";
import { Reason } from "./misc";
import { RelayerTypes } from "./relayer";

export interface SubscriptionOptions extends RelayerTypes.SubscribeOptions {
  expiry?: number;
}

export interface SubscriptionParams<Data> extends SubscriptionOptions {
  id: string;
  topic: string;
  data: Data;
  expiry: number;
}

export declare namespace SubscriptionEvent {
  export interface Payload {
    topic: string;
    payload: JsonRpcPayload;
  }

  export interface Created<T> {
    topic: string;
    data: T;
  }

  export interface Updated<T> {
    topic: string;
    data: T;
    update: Partial<T>;
  }

  export interface Deleted<T> {
    topic: string;
    data: T;
    reason: Reason;
  }
}

export type SubscriptionEntries<T> = Record<string, SubscriptionParams<T>>;

export abstract class ISubscription<Data> extends IEvents {
  public abstract subscriptions = new Map<string, SubscriptionParams<Data>>();

  public abstract readonly length: number;

  public abstract readonly topics: string[];

  public abstract readonly values: SubscriptionParams<Data>[];

  constructor(public client: IClient, public logger: Logger, public context: string) {
    super();
  }

  public abstract init(): Promise<void>;

  public abstract set(topic: string, data: Data, opts: SubscriptionOptions): Promise<void>;

  public abstract get(topic: string): Promise<Data>;

  public abstract update(topic: string, update: Partial<Data>): Promise<void>;

  public abstract delete(topic: string, reason: Reason): Promise<void>;

  // ---------- Protected ----------------------------------------------- //

  protected abstract onPayload(payloadEvent: SubscriptionEvent.Payload): Promise<any>;
}
