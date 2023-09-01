import { THIRTY_DAYS, ONE_DAY, THIRTY_SECONDS } from "@walletconnect/time";
import { RelayerTypes, PairingJsonRpcTypes } from "@walletconnect/types";

export const PAIRING_CONTEXT = "pairing";

export const PAIRING_STORAGE_VERSION = "0.3";

export const PAIRING_DEFAULT_TTL = THIRTY_DAYS;

export const PAIRING_RPC_OPTS: Record<
  PairingJsonRpcTypes.WcMethod | "unregistered_method",
  {
    req: RelayerTypes.PublishOptions;
    res: RelayerTypes.PublishOptions;
  }
> = {
  wc_pairingDelete: {
    req: {
      ttl: ONE_DAY,
      prompt: false,
      tag: 1000,
    },
    res: {
      ttl: ONE_DAY,
      prompt: false,
      tag: 1001,
    },
  },
  wc_pairingPing: {
    req: {
      ttl: THIRTY_SECONDS,
      prompt: false,
      tag: 1002,
    },
    res: {
      ttl: THIRTY_SECONDS,
      prompt: false,
      tag: 1003,
    },
  },
  unregistered_method: {
    req: {
      ttl: ONE_DAY,
      prompt: false,
      tag: 0,
    },
    res: {
      ttl: ONE_DAY,
      prompt: false,
      tag: 0,
    },
  },
};

export const PAIRING_EVENTS = {
  create: "pairing_create",
  expire: "pairing_expire",
  delete: "pairing_delete",
  ping: "pairing_ping",
};
