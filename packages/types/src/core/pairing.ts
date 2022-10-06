import { ErrorResponse } from "@walletconnect/jsonrpc-types";
import { Logger } from "pino";
import EventEmitter from "events";

import { ICore, CoreTypes } from "./core";
import { IStore } from "./store";

import { RelayerTypes } from "../core/relayer";

export declare namespace PairingTypes {
  interface Struct {
    topic: string;
    expiry: number;
    relay: RelayerTypes.ProtocolOptions;
    active: boolean;
    peerMetadata?: CoreTypes.Metadata;
  }
}

export declare namespace PairingJsonRpcTypes {
  // -- core ------------------------------------------------------- //
  export type DefaultResponse = true | ErrorResponse;

  export type WcMethod = "wc_pairingDelete" | "wc_pairingPing";

  // -- requests --------------------------------------------------- //

  export interface RequestParams {
    wc_pairingDelete: {
      code: number;
      message: string;
    };
    wc_pairingPing: Record<string, unknown>;
  }

  // -- responses -------------------------------------------------- //
  export interface Results {
    wc_pairingDelete: true;
    wc_pairingPing: true;
  }

  export type Error = ErrorResponse;
}

export type IPairingStore = IStore<string, PairingTypes.Struct>;

export abstract class IPairing {
  public abstract name: string;
  public abstract readonly context: string;
  public abstract events: EventEmitter;
  public abstract pairings: IPairingStore;

  constructor(public logger: Logger, public core: ICore) {}

  public abstract init(): Promise<void>;

  public abstract pair(params: { uri: string }): Promise<PairingTypes.Struct>;

  // for proposer to create inactive pairing
  public abstract create(): Promise<{ topic: string; uri: string }>;

  // for either to activate a previously created pairing
  public abstract activate(params: { topic: string }): Promise<void>;

  // TODO: add missing return type here once defined in spec.
  // for both to subscribe on methods requests
  // public abstract register(params: { methods: string });

  // for either to update the expiry of an existing pairing.
  public abstract updateExpiry(params: { topic: string; expiry: number }): Promise<void>;

  // for either to update the metadata of an existing pairing.
  public abstract updateMetadata(params: {
    topic: string;
    metadata: CoreTypes.Metadata;
  }): Promise<void>;

  // query pairings
  public abstract getPairings(): PairingTypes.Struct[];

  // for either to ping a peer
  public abstract ping(params: { topic: string }): Promise<void>;

  // for either peer to disconnect a pairing
  public abstract disconnect(params: { topic: string }): Promise<void>;
}

export interface IPairingPrivate {
  sendRequest<M extends PairingJsonRpcTypes.WcMethod>(
    topic: string,
    method: M,
    params: PairingJsonRpcTypes.RequestParams[M],
  ): Promise<number>;

  sendResult<M extends PairingJsonRpcTypes.WcMethod>(
    id: number,
    topic: string,
    result: PairingJsonRpcTypes.Results[M],
  ): Promise<void>;

  sendError(id: number, topic: string, error: PairingJsonRpcTypes.Error): Promise<void>;

  deletePairing(topic: string, expirerHasDeleted?: boolean): Promise<void>;
}
