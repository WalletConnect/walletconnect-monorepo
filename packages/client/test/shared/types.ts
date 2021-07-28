import { ErrorResponse, RequestArguments } from "@walletconnect/jsonrpc-utils";
import { IClient, SessionTypes, ClientOptions, AppMetadata } from "@walletconnect/types";

export interface InitializedClients {
  a: IClient;
  b: IClient;
}

export interface ClientSetup {
  options?: ClientOptions;
  state?: SessionTypes.State;
  permissions?: SessionTypes.BasePermissions;
}

export type ClientSetupMap = Record<string, ClientSetup>;
export type InitializedSetup = Record<string, Required<ClientSetup>>;

export interface CientSetupInitialized {
  clients: InitializedClients;
  setup: InitializedSetup;
}

export interface ClientSetupOptions {
  clients?: InitializedClients;
  setup?: ClientSetupMap;
  shared?: ClientSetup;
}

export interface RequestScenarioOptions {
  topic: string;
  clients: InitializedClients;
  chainId?: string;
  request: RequestArguments;
  error?: ErrorResponse;
  result?: any;
}
