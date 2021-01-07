import { RequestArguments } from "@json-rpc-tools/utils";
import { IClient, SessionTypes, ClientOptions, SignalTypes } from "@walletconnect/types";

export interface InitializedClients {
  a: IClient;
  b: IClient;
}

export interface ClientSetup {
  options?: ClientOptions;
  state?: SessionTypes.State;
  metadata?: SessionTypes.Metadata;
  permissions?: SessionTypes.BasePermissions;
}

export type ClientSetupMap = Record<string, ClientSetup>;
export type InitializedSetup = Record<string, Required<ClientSetup>>;

export interface SessionScenarioInitialized {
  clients: InitializedClients;
  setup: InitializedSetup;
}

export interface SessionScenarioSetup {
  clients?: InitializedClients;
  setup?: ClientSetupMap;
  pairing?: SignalTypes.ParamsPairing;
  scenario?: string;
}

export interface RequestScenarioOptions {
  topic: string;
  clients: InitializedClients;
  chainId?: string;
  request?: RequestArguments;
  result?: any;
}
