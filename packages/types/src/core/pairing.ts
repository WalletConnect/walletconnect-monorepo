import { Logger } from "pino";

import { ICore } from "./core";
import { IStore } from "./store";

import { RelayerTypes } from "../core/relayer";

export declare namespace PairingTypes {
  export interface Struct {
    topic: string;
    expiry: number;
    relay: RelayerTypes.ProtocolOptions;
    active: boolean;
    // TODO: Establish `Metadata` type outside of SignClient types. Then tighten type here.
    peerMetadata?: Record<string, any>;
  }
}

export type IPairingStore = IStore<string, PairingTypes.Struct>;

export abstract class IPairing {
  public abstract name: string;
  public abstract readonly context: string;
  public abstract pairings: IPairingStore;

  constructor(public logger: Logger, public core: ICore) {}

  public abstract init(): Promise<void>;

  public abstract pair(params: { uri: string }): Promise<PairingTypes.Struct>;

  // for proposer to create inactive pairing
  public abstract create(): Promise<{ uri: string }>;

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
    metadata: Record<string, any>;
  }): Promise<void>;

  // query pairings
  public abstract getPairings(): Promise<PairingTypes.Struct[]>;

  // for either to ping a peer
  public abstract ping(params: { topic: string }): Promise<void>;

  // for either peer to disconnect a pairing
  public abstract disconnect(params: { topic: string }): Promise<void>;
}
