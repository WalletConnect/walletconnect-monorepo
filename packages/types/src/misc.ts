import { CryptoTypes } from "./crypto";
import { RelayerTypes } from "./relayer";

export declare namespace SignalTypes {
  export type Method = MethodPairing | MethodUri;

  export type Params = ParamsPairing | ParamsUri;

  export interface Base {
    method: Method;
    params: Params;
  }

  export type MethodPairing = "pairing";

  export interface ParamsPairing {
    topic: string;
  }

  export interface Pairing extends Base {
    method: MethodPairing;
    params: ParamsPairing;
  }

  export type MethodUri = "uri";

  export interface ParamsUri {
    uri: string;
  }

  export interface Uri extends Base {
    method: MethodUri;
    params: ParamsUri;
  }
}

export interface JsonRpcPermissions {
  methods: string[];
}

export declare namespace NotificationPermissions {
  export interface Proposal {
    types: string[];
  }

  export interface Settled {
    types: string[];
    controller: CryptoTypes.Participant;
  }
}

export declare namespace BlockchainTypes {
  export interface Permissions {
    chainIds: string[];
  }
  export interface State {
    accountIds: string[];
  }
}

export interface UriParameters {
  protocol: string;
  version: number;
  topic: string;
  publicKey: string;
  relay: RelayerTypes.ProtocolOptions;
}

export declare namespace Validation {
  export interface Valid {
    valid: true;
  }

  export interface Invalid {
    valid: false;
    error: string;
  }

  export type Result = Valid | Invalid;
}
