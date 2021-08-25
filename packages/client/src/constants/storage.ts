import { StorageKeyMap } from "@walletconnect/types";

export const STORAGE_CONTEXT = "storage";

export const STORAGE_VERSION = "0.1";

export const STORAGE_KEYS: StorageKeyMap = {
  crypto: {
    keychain: "crypto:keychain",
  },
  session: {
    pending: "session:pending",
    settled: "session:settled",
    history: "session:history",
  },
  pairing: {
    pending: "pairing:pending",
    settled: "pairing:settled",
    history: "pairing:history",
  },
  relayer: {
    history: "relayer:history",
    subscription: "relayer:subscription",
  },
};
