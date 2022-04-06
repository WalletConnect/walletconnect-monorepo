import type { AppMetadata } from "./misc";

export declare namespace NewTypes {
  // types/relay.ts RelayerTypes.ProtocolOptions
  interface ProtocolOptions {
    protocol: string;
    data?: string;
  }

  // types/misc.ts UriParameters
  interface UriParameters {
    version: number;
    topic: string;
    symetricKey: string;
    relayProtocol: string;
    relayData?: string;
  }

  // types/sequence.ts SequenceTypes.Proposal
  interface Pairing {
    topic: string;
    expiry: number;
    relayProtocol: string;
    uri: string;
    isActive: boolean;
    selfMetadata?: AppMetadata;
    peerMetadata?: AppMetadata;
    relayData?: string;
  }
}
