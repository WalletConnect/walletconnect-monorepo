import { SessionTypes } from "@walletconnect/types";
import { ChainsMap } from "caip-api";

import { AppState } from "../App";

export interface ChainRequestRender {
  label: string;
  value: string;
}

export interface AppEvents {
  init: (state: AppState, setState: any) => Promise<void>;
  update: (state: AppState, setState: any) => Promise<void>;
}

export interface ChainMetadata {
  name?: string;
  logo: string;
  rgb: string;
}

export interface NamespaceMetadata {
  [reference: string]: ChainMetadata;
}

export interface ChainNamespaces {
  [namespace: string]: ChainsMap;
}

export declare namespace Cards {
  export interface Default {
    type: "default";
    data: any;
  }

  export interface Proposal {
    type: "proposal";
    data: { proposal: SessionTypes.Proposal };
  }

  export interface Session {
    type: "session";
    data: { session: SessionTypes.Created };
  }

  export interface Request {
    type: "request";
    data: { requestEvent: SessionTypes.RequestEvent; peer: SessionTypes.Participant };
  }

  export interface Settings {
    type: "settings";
    data: { mnemonic: string; chains: string[] };
  }

  export type All = Default | Proposal | Session | Request | Settings;
}
