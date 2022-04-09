import { AppMetadata, BlockchainTypes, JsonRpcPermissions, NotificationPermissions } from "./misc";
import { RelayerTypes } from "./relayer";
import { IStore } from "./store";

export declare namespace SessionTypes {
  interface Data {
    topic: string;
    permissions: SessionTypes.Permissions;
  }

  interface Permissions {
    jsonrpc: JsonRpcPermissions;
    blockchain?: BlockchainTypes.Permissions;
    notifications?: NotificationPermissions;
  }

  interface CreateSessionParams {
    relayProtocol: RelayerTypes.ProtocolOptions["protocol"];
    relayData?: RelayerTypes.ProtocolOptions["data"];
    pairingTopic?: string;
    expiry?: number;
    permissions?: SessionTypes.Permissions;
    metadata?: AppMetadata;
  }

  type SessionPairParams = string
}

export interface ISession extends IStore<SessionTypes.Data> {
  find: (permissions: SessionTypes.Permissions) => SessionTypes.Data[];
}
