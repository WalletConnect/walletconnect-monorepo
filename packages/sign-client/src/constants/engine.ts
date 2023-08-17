import { FIVE_MINUTES, ONE_DAY, SEVEN_DAYS, THIRTY_SECONDS } from "@walletconnect/time";
import { EngineTypes } from "@walletconnect/types";

export const ENGINE_CONTEXT = "engine";

export const ENGINE_RPC_OPTS: EngineTypes.RpcOptsMap = {
  wc_sessionPropose: {
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
  wc_sessionSettle: {
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
  wc_sessionUpdate: {
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
  wc_sessionExtend: {
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
  wc_sessionRequest: {
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
  wc_sessionEvent: {
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

  wc_sessionDelete: {
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
  wc_sessionPing: {
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
};

export const SESSION_REQUEST_EXPIRY_BOUNDARIES = {
  min: FIVE_MINUTES,
  max: SEVEN_DAYS,
};

export const ENGINE_QUEUE_STATES: { idle: "IDLE"; active: "ACTIVE" } = {
  idle: "IDLE",
  active: "ACTIVE",
};
