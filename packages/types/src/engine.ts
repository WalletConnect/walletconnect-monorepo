import { AppMetadata } from "./misc";
import { RelayerTypes } from "./relayer";
import { SessionTypes } from "./session";

export declare namespace EngineTypes {
  interface CreateSessionParams {
    relay: RelayerTypes.ProtocolOptions;
    pairingTopic?: string;
    expiry?: number;
    permissions?: SessionTypes.Permissions;
    metadata?: AppMetadata;
  }

  interface UriParameters {
    version: number;
    topic: string;
    symetricKey: string;
    relayProtocol: string;
    relayData?: string;
  }
}

export interface IEngine {
  createSession(params: EngineTypes.CreateSessionParams): Promise<void>;
  pair(pairingUri: string): Promise<void>;
  approve(): Promise<void>;
  reject(): Promise<void>;
  updateAccounts(): Promise<void>;
  updateMethods(): Promise<void>;
  updateEvents(): Promise<void>;
  updateExpiry(): Promise<void>;
  request(): Promise<void>;
  respond(): Promise<void>;
  ping(): Promise<void>;
  notify(): Promise<void>;
  disconnect(): Promise<void>;
}
