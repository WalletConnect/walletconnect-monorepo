import { IEvents } from "@walletconnect/events";
import { IJsonRpcProvider, JsonRpcPayload, RequestArguments } from "@walletconnect/jsonrpc-types";
import { Logger } from "@walletconnect/logger";

import { ICore } from "./core.js";
import { IMessageTracker } from "./messages.js";
import { IPublisher } from "./publisher.js";
import { ISubscriber } from "./subscriber.js";

export declare namespace RelayerTypes {
  export interface ProtocolOptions {
    protocol: string;
    data?: string;
  }
  export interface PublishOptions {
    relay?: ProtocolOptions;
    ttl?: number;
    prompt?: boolean;
    tag?: number;
    id?: number;
    internal?: {
      throwOnFailedPublish?: boolean;
    };
    tvf?: ITVF;
    attestation?: string;
    publishMethod?: string;
  }

  export type TransportType = "relay" | "link_mode";

  export interface SubscribeOptions {
    relay?: ProtocolOptions;
    transportType?: TransportType;
    internal?: {
      throwOnFailedPublish?: boolean;
      skipSubscribe?: boolean;
    };
  }

  export interface UnsubscribeOptions {
    id?: string;
    relay: ProtocolOptions;
  }

  export type RequestOptions = PublishOptions | SubscribeOptions | UnsubscribeOptions;

  export interface PublishPayload {
    topic: string;
    message: string;
    opts?: RelayerTypes.PublishOptions;
  }
  export interface MessageEvent {
    topic: string;
    message: string;
    publishedAt: number;
    transportType?: TransportType;
    attestation?: string;
  }

  export interface RpcUrlParams {
    protocol: string;
    version: number;
    auth: string;
    relayUrl: string;
    sdkVersion: string;
    projectId?: string;
    useOnCloseEvent?: boolean;
    bundleId?: string;
    packageName?: string;
  }

  export interface ITVF {
    correlationId?: number;
    rpcMethods?: string[];
    chainId?: string;
    txHashes?: string[];
    contractAddresses?: string[];
    approvedChains?: string[];
    approvedMethods?: string[];
    approvedEvents?: string[];
    sessionProperties?: Record<string, string>;
    scopedProperties?: Record<string, unknown>;
  }

  export type MessageDirection = "inbound" | "outbound";
}

export interface RelayerOptions {
  core: ICore;
  logger?: string | Logger;
  relayUrl?: string;
  projectId?: string;
}

export interface RelayerClientMetadata {
  protocol: string;
  version: number;
  env: string;
  host?: string;
}

export abstract class IRelayer extends IEvents {
  public abstract protocol: string;

  public abstract version: number;

  public abstract core: ICore;

  public abstract logger: Logger;

  public abstract subscriber: ISubscriber;

  public abstract publisher: IPublisher;

  public abstract messages: IMessageTracker;

  public abstract provider: IJsonRpcProvider;

  public abstract name: string;

  public abstract transportExplicitlyClosed: boolean;

  public abstract readonly context: string;

  public abstract readonly connected: boolean;

  public abstract readonly connecting: boolean;

  constructor(
    // @ts-ignore
    opts: RelayerOptions,
  ) {
    super();
  }

  public abstract init(): Promise<void>;
  public abstract dispose(): Promise<void>;
  /** @internal Check both the shared Core and the requesting owner's lifetime. */
  public abstract assertOwner(signal?: AbortSignal): void;
  /** @internal Cancel a read/network wait without closing the shared Core transport. */
  public abstract withOwner<T>(
    operation: (signal: AbortSignal) => Promise<T>,
    signal?: AbortSignal,
  ): Promise<T>;

  public abstract publish(
    topic: string,
    message: string,
    opts?: RelayerTypes.PublishOptions,
    signal?: AbortSignal,
  ): Promise<void>;

  public abstract publishCustom(
    params: {
      payload: any;
      opts?: RelayerTypes.PublishOptions;
    },
    signal?: AbortSignal,
  ): Promise<void>;

  public abstract request(request: RequestArguments, signal?: AbortSignal): Promise<JsonRpcPayload>;

  public abstract subscribe(
    topic: string,
    opts?: RelayerTypes.SubscribeOptions,
    signal?: AbortSignal,
  ): Promise<string>;

  public abstract unsubscribe(
    topic: string,
    opts?: RelayerTypes.UnsubscribeOptions,
    signal?: AbortSignal,
  ): Promise<void>;

  public abstract transportClose(): Promise<void>;
  public abstract transportOpen(relayUrl?: string): Promise<void>;
  public abstract restartTransport(relayUrl?: string): Promise<void>;
  public abstract confirmOnlineStateOrThrow(signal?: AbortSignal): Promise<void>;
  public abstract handleBatchMessageEvents(messages: RelayerTypes.MessageEvent[]): Promise<void>;
  public abstract onLinkMessageEvent(
    messageEvent: RelayerTypes.MessageEvent,
    opts?: { sessionExists?: boolean },
  ): Promise<void>;
}
