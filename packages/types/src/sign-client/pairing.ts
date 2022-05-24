import { SignClientTypes } from "./client";
import { RelayerTypes } from "../core/relayer";
import { IStore } from "../core/store";

export declare namespace PairingTypes {
  export interface Struct {
    topic: string;
    expiry: number;
    relay: RelayerTypes.ProtocolOptions;
    active: boolean;
    peerMetadata?: SignClientTypes.Metadata;
  }
}

export type IPairing = IStore<string, PairingTypes.Struct>;
