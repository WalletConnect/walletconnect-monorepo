import { IEvents } from "@walletconnect/events";
import { ErrorResponse } from "@walletconnect/jsonrpc-types";
import { Logger } from "@walletconnect/logger";

import { IRelayer, RelayerTypes } from "./relayer";

export declare namespace SubscriberTypes {
  export interface Params extends RelayerTypes.SubscribeOptions {
    topic: string;
  }

  export interface Active extends Params {
    id: string;
  }
}

export declare namespace SubscriberEvents {
  export type Created = SubscriberTypes.Active;

  export interface Deleted extends SubscriberTypes.Active {
    reason: ErrorResponse;
  }

  export type Expired = Deleted;
}

export abstract class ISubscriberTopicMap {
  public map = new Map<string, string[]>();

  public abstract readonly topics: string[];

  public abstract set(topic: string, id: string): void;

  public abstract get(topic: string): string[];

  public abstract exists(topic: string, id: string): boolean;

  public abstract delete(topic: string, id?: string): void;

  public abstract clear(): void;
}

export abstract class ISubscriber extends IEvents {
  public abstract subscriptions: Map<string, SubscriberTypes.Active>;

  public abstract topicMap: ISubscriberTopicMap;

  public abstract pending: Map<string, SubscriberTypes.Params>;

  public abstract readonly length: number;

  public abstract readonly ids: string[];

  public abstract readonly values: SubscriberTypes.Active[];

  public abstract readonly topics: string[];

  public abstract name: string;

  public abstract readonly context: string;

  constructor(public relayer: IRelayer, public logger: Logger) {
    super();
  }

  public abstract init(): Promise<void>;

  public abstract subscribe(
    topic: string,
    opts?: RelayerTypes.SubscribeOptions,
  ): Promise<string | null>;

  public abstract unsubscribe(topic: string, opts?: RelayerTypes.UnsubscribeOptions): Promise<void>;

  public abstract isSubscribed(topic: string): Promise<boolean>;

  public abstract start(): Promise<void>;

  public abstract stop(): Promise<void>;
}
