import { IEvents } from "@walletconnect/jsonrpc-types";
import { Logger } from "pino";

import { IClient } from "./client";
import { Reason } from "./misc";
import { IRelayer, RelayerTypes } from "./relayer";

export interface SubscriptionParams extends RelayerTypes.SubscribeOptions {
  id: string;
  topic: string;
  expiry: number;
}

export declare namespace SubscriptionEvent {
  export type Created = SubscriptionParams;

  export interface Deleted extends SubscriptionParams {
    reason: Reason;
  }
}

export abstract class ISubscription extends IEvents {
  public abstract subscriptions = new Map<string, SubscriptionParams>();

  public abstract topicMap = new Map<string, string[]>();

  public abstract readonly length: number;

  public abstract readonly ids: string[];

  public abstract readonly values: SubscriptionParams[];

  public abstract readonly topics: string[];

  public abstract context: string;

  constructor(public client: IClient, public logger: Logger) {
    super();
  }

  public abstract init(): Promise<void>;

  public abstract set(id: string, subscription: SubscriptionParams): Promise<void>;

  public abstract get(id: string): Promise<SubscriptionParams>;

  public abstract delete(id: string, reason: Reason): Promise<void>;

  public abstract exists(id: string): Promise<boolean>;

  public abstract enable(): Promise<void>;

  public abstract disable(): Promise<void>;
}
