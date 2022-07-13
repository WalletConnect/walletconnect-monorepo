import { ONE_DAY, FIVE_MINUTES, THIRTY_SECONDS } from "@walletconnect/time";
import { RelayerTypes, JsonRpcTypes } from "@walletconnect/types";

export const ENGINE_CONTEXT = "engine";

// TODO: move interface to @walletconnect/types
interface EngineRpcConfig {
  method: string;
  opts: {
    req: RelayerTypes.PublishOptions;
    res: RelayerTypes.PublishOptions;
  };
}

// TODO: move type to @walletconnect/types
type EngineRpcMap = Record<JsonRpcTypes.WcMethod, EngineRpcConfig>;

export const ENGINE_RPC: EngineRpcMap = {
  wc_pairingDelete: {
    method: "wc_pairingDelete",
    opts: {
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
  },
  wc_pairingPing: {
    method: "wc_pairingPing",
    opts: {
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
  },
  wc_sessionPropose: {
    method: "wc_sessionPropose",
    opts: {
      req: {
        ttl: FIVE_MINUTES,
        prompt: true,
        tag: 1100,
      },
      res: {
        ttl: FIVE_MINUTES,
        prompt: false,
        tag: 1101,
      },
    },
  },
  wc_sessionSettle: {
    method: "wc_sessionSettle",
    opts: {
      req: {
        ttl: FIVE_MINUTES,
        prompt: false,
        tag: 1102,
      },
      res: {
        ttl: FIVE_MINUTES,
        prompt: false,
        tag: 1103,
      },
    },
  },
  wc_sessionUpdate: {
    method: "wc_sessionUpdate",
    opts: {
      req: {
        ttl: ONE_DAY,
        prompt: false,
        tag: 1104,
      },
      res: {
        ttl: ONE_DAY,
        prompt: false,
        tag: 1105,
      },
    },
  },
  wc_sessionExtend: {
    method: "wc_sessionExtend",
    opts: {
      req: {
        ttl: ONE_DAY,
        prompt: false,
        tag: 1106,
      },
      res: {
        ttl: ONE_DAY,
        prompt: false,
        tag: 1107,
      },
    },
  },
  wc_sessionRequest: {
    method: "wc_sessionRequest",
    opts: {
      req: {
        ttl: FIVE_MINUTES,
        prompt: true,
        tag: 1108,
      },
      res: {
        ttl: FIVE_MINUTES,
        prompt: false,
        tag: 1109,
      },
    },
  },
  wc_sessionEvent: {
    method: "wc_sessionEvent",
    opts: {
      req: {
        ttl: FIVE_MINUTES,
        prompt: true,
        tag: 1110,
      },
      res: {
        ttl: FIVE_MINUTES,
        prompt: false,
        tag: 1111,
      },
    },
  },

  wc_sessionDelete: {
    method: "wc_sessionDelete",
    opts: {
      req: {
        ttl: ONE_DAY,
        prompt: false,
        tag: 1112,
      },
      res: {
        ttl: ONE_DAY,
        prompt: false,
        tag: 1113,
      },
    },
  },
  wc_sessionPing: {
    method: "wc_sessionPing",
    opts: {
      req: {
        ttl: THIRTY_SECONDS,
        prompt: false,
        tag: 1114,
      },
      res: {
        ttl: THIRTY_SECONDS,
        prompt: false,
        tag: 1115,
      },
    },
  },
};
