import { FIVE_MINUTES, ONE_DAY, ONE_HOUR, SEVEN_DAYS } from "@walletconnect/time";
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
    reject: {
      ttl: FIVE_MINUTES,
      prompt: false,
      tag: 1120,
    },
    autoReject: {
      ttl: FIVE_MINUTES,
      prompt: false,
      tag: 1121,
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
      ttl: FIVE_MINUTES * 3,
      prompt: true,
      tag: 1108,
    },
    res: {
      ttl: FIVE_MINUTES * 3,
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
      ttl: ONE_DAY,
      prompt: false,
      tag: 1114,
    },
    res: {
      ttl: ONE_DAY,
      prompt: false,
      tag: 1115,
    },
  },
  wc_sessionAuthenticate: {
    req: {
      ttl: ONE_HOUR,
      prompt: true,
      tag: 1116,
    },
    res: {
      ttl: ONE_HOUR,
      prompt: false,
      tag: 1117,
    },
    reject: {
      ttl: FIVE_MINUTES,
      prompt: false,
      tag: 1118,
    },
    autoReject: {
      ttl: FIVE_MINUTES,
      prompt: false,
      tag: 1119,
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

export const TVF_METHODS = {
  // evm
  eth_sendTransaction: {
    key: "",
  },
  eth_sendRawTransaction: {
    key: "",
  },
  wallet_sendCalls: {
    key: "",
  },

  // solana
  solana_signTransaction: {
    key: "signature",
  },
  solana_signAllTransactions: {
    key: "transactions",
  },
  solana_signAndSendTransaction: {
    key: "signature",
  },

  // sui
  sui_signAndExecuteTransaction: {
    key: "digest",
  },
  sui_signTransaction: {
    key: "",
  },

  // hedera
  hedera_signAndExecuteTransaction: {
    key: "transactionId",
  },
  hedera_executeTransaction: {
    key: "transactionId",
  },

  // near
  near_signTransaction: {
    key: "",
  },
  near_signTransactions: {
    key: "",
  },

  // tron
  tron_signTransaction: {
    key: "txID",
  },

  // xrpl
  xrpl_signTransaction: {
    key: "",
  },

  xrpl_signTransactionFor: {
    key: "",
  },

  // algorand
  algo_signTxn: {
    key: "",
  },

  // bitcoin
  sendTransfer: {
    key: "txid",
  },

  // stacks
  stacks_stxTransfer: {
    key: "txId",
  },

  // polkadot
  polkadot_signTransaction: {
    key: "",
  },

  // cosmos
  cosmos_signDirect: {
    key: "",
  },
};
