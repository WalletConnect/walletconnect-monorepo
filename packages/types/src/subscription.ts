import { JsonRpcPayload, IEvents } from "@walletconnect/jsonrpc-types";
import { Logger } from "pino";

import { IClient } from "./client";
import { Reason } from "./misc";
import { RelayerTypes } from "./relayer";

export interface SubscriptionOptions extends RelayerTypes.SubscribeOptions {
  topic: string;
  expiry: number;
}

export interface SubscriptionParams extends SubscriptionOptions {
  id: string;
}

export declare namespace SubscriptionEvent {
  export type Created = SubscriptionParams;

  export interface Deleted extends SubscriptionParams {
    reason: Reason;
  }
}

export type SubscriptionEntries<T> = Record<string, SubscriptionParams>;

export abstract class ISubscription<Data> extends IEvents {
  public abstract subscriptions = new Map<string, SubscriptionParams>();

  public abstract readonly length: number;

  public abstract readonly topics: string[];

  public abstract readonly values: SubscriptionParams[];

  constructor(public client: IClient, public logger: Logger, public context: string) {
    super();
  }

  public abstract init(): Promise<void>;

  public abstract set(id: string, opts: SubscriptionOptions): Promise<void>;

  public abstract get(id: string): Promise<SubscriptionParams>;

  public abstract delete(id: string, reason: Reason): Promise<void>;
}
