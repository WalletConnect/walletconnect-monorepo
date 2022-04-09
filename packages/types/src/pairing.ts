import { AppMetadata } from "./misc";
import { RelayerTypes } from "./relayer";
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

  interface CreatePairingParams {
    relayProtocol: RelayerTypes.ProtocolOptions["protocol"];
    relayData?: RelayerTypes.ProtocolOptions["data"];
  }
}

export type IPairing = IStore<PairingTypes.Data>;
