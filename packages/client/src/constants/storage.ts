import { StorageKeyMap } from "@walletconnect/types";

export const STORAGE_CONTEXT = "storage";

export const STORAGE_VERSION = "0.2";

export const STORAGE_KEYS: StorageKeyMap = {
  crypto: {
    keychain: "crypto:keychain",
  },
  session: {
    pending: "session:pending",
    settled: "session:settled",
    history: "session:history",
    expirer: "session:expirer",
  },
  pairing: {
    pending: "pairing:pending",
    settled: "pairing:settled",
    history: "pairing:history",
    expirer: "pairing:expirer",
  },
  relayer: {
    history: "relayer:history",
    subscription: "relayer:subscription",
  },
};
