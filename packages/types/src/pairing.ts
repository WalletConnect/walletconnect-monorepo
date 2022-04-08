import { AppMetadata } from "./misc";
import { IStore } from "./store";

export declare namespace PairingTypes {
  export interface Data {
    topic: string;
    expiry: number;
    relayProtocol: string;
    uri: string;
    isActive: boolean;
    peerMetadata?: AppMetadata;
    relayData?: string;
  }
}

export type IPairing = IStore<PairingTypes.Data>;
