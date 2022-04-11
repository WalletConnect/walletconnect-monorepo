import { ClientTypes } from "./client";
import { RelayerTypes } from "./relayer";
import { SessionTypes } from "./session";

export declare namespace EngineTypes {
  interface UriParameters {
    version: number;
    topic: string;
    symKey: string;
    relayProtocol: string;
    relayData?: string;
  }

  type CreatePairingParams = RelayerTypes.ProtocolOptions;

  interface CreateSessionParams {
    relay: RelayerTypes.ProtocolOptions;
    pairingTopic?: string;
    expiry?: number;
    permissions?: SessionTypes.Permissions;
    metadata?: ClientTypes.Metadata;
  }
}

export interface IEngine {
  connect(params: EngineTypes.CreateSessionParams): Promise<void>;
  pair(pairingUri: string): Promise<void>;
  approveSession(): Promise<void>;
  rejectSession(): Promise<void>;
  updateAccounts(): Promise<void>;
  updateMethods(): Promise<void>;
  updateEvents(): Promise<void>;
  updateExpiry(): Promise<void>;
  request(): Promise<void>;
  respond(): Promise<void>;
  pingSession(): Promise<void>;
  pingPairing(): Promise<void>;
  deleteSession(): Promise<void>;
  deletePairing(): Promise<void>;
  emit(): Promise<void>;
}
