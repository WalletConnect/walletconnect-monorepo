import { JsonRpcPayload } from "rpc-json-types";

import { IClient } from "./client";
import { IEvents } from "./events";
import { RelayTypes } from "./relay";

export interface SubscriptionContext {
  name: string;
  status: string;
  encrypted: boolean;
}

export interface SubscriptionOptions extends RelayTypes.SubscribeOptions {
  relay: RelayTypes.ProtocolOptions;
}
export interface SubscriptionParams<Data> {
  topic: string;
  data: Data;
  opts: SubscriptionOptions;
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
  }

  export interface Deleted<T> {
    topic: string;
    data: T;
    reason: string;
  }
}

export type SubscriptionEntries<T> = Record<string, SubscriptionParams<T>>;

export abstract class ISubscription<Data> extends IEvents {
  public abstract subscriptions = new Map<string, SubscriptionParams<Data>>();

  public abstract readonly length: number;

  public abstract readonly entries: SubscriptionEntries<Data>;

  constructor(public client: IClient, public context: SubscriptionContext) {
    super();
  }

  public abstract init(): Promise<void>;

  public abstract set(topic: string, data: Data, opts: SubscriptionOptions): Promise<void>;

  public abstract get(topic: string): Promise<Data>;

  public abstract update(topic: string, update: Partial<Data>): Promise<void>;

  public abstract delete(topic: string, reason: string): Promise<void>;

  // ---------- Protected ----------------------------------------------- //

  protected abstract onMessage(payloadEvent: SubscriptionEvent.Payload): Promise<any>;
}
