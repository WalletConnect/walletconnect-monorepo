import { Core } from "@walletconnect/core";
import { Web3WalletTypes } from "../types";
import { SessionStore } from "@walletconnect/sign-client";

export const Notifications: Web3WalletTypes.INotifications = {
  decryptMessage: async (params) => {
    const core = new Core({
      storageOptions: params.storageOptions,
      storage: params.storage,
    });
    await core.crypto.init();
    return core.crypto.decode(params.topic, params.encryptedMessage);
  },
  getMetadata: async (params) => {
    const core = new Core({
      storageOptions: params.storageOptions,
      storage: params.storage,
    });
    const sessionStore = new SessionStore(core, core.logger);
    await sessionStore.init();
    const session = sessionStore.get(params.topic);
    return session?.peer.metadata;
  },
};
