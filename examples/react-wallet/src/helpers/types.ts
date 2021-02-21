import { SessionTypes } from "@walletconnect/types";
import { ChainConfig } from "caip-wallet";

import { AppState } from "../App";

export interface ChainRequestRender {
  label: string;
  value: string;
}

export interface AppEvents {
  init: (state: AppState, setState: any) => Promise<void>;
  update: (state: AppState, setState: any) => Promise<void>;
}

export interface ChainMetadata extends ChainConfig {
  logo: string;
  rgb: string;
}

export interface NamespaceMetadata {
  [reference: string]: ChainMetadata;
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
    data: { request: SessionTypes.PayloadEvent; peer: SessionTypes.Peer };
  }

  export interface Settings {
    type: "settings";
    data: { mnemonic: string; chains: string[] };
  }

  export type All = Default | Proposal | Session | Request | Settings;
}
