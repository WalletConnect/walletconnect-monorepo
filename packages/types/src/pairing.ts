import { ClientTypes } from "./client";
import { RelayerTypes } from "./relayer";
import { IStore } from "./store";

export declare namespace PairingTypes {
  export interface Struct {
    topic: string;
    expiry: number;
    relay: RelayerTypes.ProtocolOptions;
    active: boolean;
    peerMetadata?: ClientTypes.Metadata;
  }
}

export type IPairing = IStore<PairingTypes.Struct>;
