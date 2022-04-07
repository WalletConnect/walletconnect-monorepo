import { AppMetadata } from "./misc";

export declare namespace NewTypes {
  // types/relay.ts RelayerTypes.ProtocolOptions
  interface Relay {
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

  interface Pairing {
    topic: string;
    expiry: number;
    relayProtocol: string;
    uri: string;
    isActive: boolean;
    peerMetadata?: AppMetadata;
    relayData?: string;
  }

  interface SessionPermissions {
    blockchains: {
      chains: string[];
      accounts: string[];
    };
    notifications?: {
      types: string[];
    };
  }

  // types/sequence.ts SequenceTypes.ProposeParams
  interface CreateSessionParams {
    relay: NewTypes.Relay;
    pairingTopic?: string;
    expiry?: number;
    permissions?: SessionPermissions;
    metadata?: AppMetadata;
  }
}
