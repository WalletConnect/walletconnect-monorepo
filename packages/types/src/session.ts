import { BlockchainTypes, JsonRpcPermissions, NotificationPermissions } from "./misc";
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
}

export interface ISession extends IStore<SessionTypes.Data> {
  find: (permissions: SessionTypes.Permissions) => SessionTypes.Data[];
}
