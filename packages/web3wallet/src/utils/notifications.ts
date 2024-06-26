import { Core } from "@walletconnect/core";
import { Web3WalletTypes } from "../types";
import { SessionStore } from "@walletconnect/sign-client";

export const Notifications: Web3WalletTypes.INotifications = {
  decryptMessage: async (params) => {
    const instance = {
      core: new Core({
        storageOptions: params.storageOptions,
        storage: params.storage,
      }),
    } as any;
    await instance.core.crypto.init();
    const decoded = instance.core.crypto.decode(params.topic, params.encryptedMessage);
    instance.core = null;
    return decoded;
  },
  getMetadata: async (params) => {
    const instances = {
      core: new Core({
        storageOptions: params.storageOptions,
        storage: params.storage,
      }),
      sessionStore: null,
    } as any;
    instances.sessionStore = new SessionStore(instances.core, instances.core.logger);
    await instances.sessionStore.init();
    const session = instances.sessionStore.get(params.topic);
    const metadata = session?.peer.metadata;
    instances.core = null;
    instances.sessionStore = null;
    return metadata;
  },
};
