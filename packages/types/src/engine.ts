import {
  JsonRpcResponse,
  JsonRpcRequest,
  ErrorResponse,
  RequestArguments,
} from "@walletconnect/jsonrpc-types";
import { IClient } from "./client";
import { RelayerTypes } from "./relayer";
import { SessionTypes } from "./session";
import { IPromises } from "./promises";
import { JsonRpcTypes } from "./jsonrpc";

export declare namespace EngineTypes {
  interface UriParameters {
    protocol: string;
    version: number;
    topic: string;
    symKey: string;
    relay: RelayerTypes.ProtocolOptions;
  }

  interface EventCallback<T extends JsonRpcRequest | JsonRpcResponse> {
    topic: string;
    payload: T;
  }

  interface CreateSessionParams {
    pairingTopic?: string;
    methods?: SessionTypes.Methods;
    chains?: SessionTypes.Chains;
    events?: SessionTypes.Events;
    relays?: RelayerTypes.ProtocolOptions[];
  }

  interface PairParams {
    uri: string;
  }
  interface ApproveParams {
    proposerPublicKey: string;
    accounts: SessionTypes.Accounts;
    methods: SessionTypes.Methods;
    events: SessionTypes.Events;
    relayProtocol?: string;
  }

  interface RejectParams {
    proposerPublicKey: string;
    reason: ErrorResponse;
  }

  interface UpdateAccountsParams {
    topic: string;
    accounts: SessionTypes.Accounts;
  }

  interface UpdateMethodsParams {
    topic: string;
    methods: SessionTypes.Methods;
  }

  interface UpdateEventsParams {
    topic: string;
    events: SessionTypes.Events;
  }

  interface UpdateExpiryParams {
    topic: string;
    expiry: SessionTypes.Expiry;
  }

  interface RequestParams<T = any> {
    topic: string;
    request: RequestArguments<T>;
    chainId?: string;
  }

  interface RespondParams {
    topic: string;
    response: JsonRpcResponse;
  }

  interface EmitParams {
    topic: string;
    event: {
      name: string;
      data: any;
    };
    chainId?: string;
  }

  interface PingParams {
    topic: string;
  }

  interface DisconnectParams {
    topic: string;
    reason: ErrorResponse;
  }
}

// -- private method interface -------------------------------------- //

export interface EnginePrivate {
  sendRequest<M extends JsonRpcTypes.WcMethod>(
    topic: string,
    method: M,
    params: JsonRpcTypes.RequestParams[M],
  ): Promise<{ id: number }>;

  sendResponse<M extends JsonRpcTypes.WcMethod>(
    topic: string,
    method: M,
    response: JsonRpcTypes.Responses[M],
  ): Promise<void>;

  onRelayEventRequest(event: EngineTypes.EventCallback<JsonRpcRequest>): void;

  onRelayEventResponse(event: EngineTypes.EventCallback<JsonRpcResponse>): Promise<void>;

  onSessionProposeRequest(
    topic: string,
    payload: JsonRpcRequest<JsonRpcTypes.RequestParams["wc_sessionPropose"]>,
  ): Promise<void>;

  onSessionUpdateAccountsRequest(
    topic: string,
    payload: JsonRpcRequest<JsonRpcTypes.RequestParams["wc_sessionUpdateAccounts"]>,
  ): Promise<void>;

  onSessionUpdateAccountsResponse(
    topic: string,
    payload: JsonRpcResponse<JsonRpcTypes.Responses["wc_sessionUpdateAccounts"]>,
  ): Promise<void>;
}

// -- class interface ----------------------------------------------- //

export abstract class IEngine {
  public abstract promises: IPromises;

  constructor(public client: IClient) {}

  public abstract createSession(
    params: EngineTypes.CreateSessionParams,
  ): Promise<{ uri?: string; approval: Promise<void> }>;

  public abstract pair(params: EngineTypes.PairParams): Promise<void>;

  public abstract approve(params: EngineTypes.ApproveParams): Promise<SessionTypes.Struct>;

  public abstract reject(params: EngineTypes.RejectParams): Promise<void>;

  public abstract updateAccounts(params: EngineTypes.UpdateAccountsParams): Promise<void>;

  public abstract updateMethods(params: EngineTypes.UpdateMethodsParams): Promise<void>;

  public abstract updateEvents(params: EngineTypes.UpdateEventsParams): Promise<void>;

  public abstract updateExpiry(params: EngineTypes.UpdateExpiryParams): Promise<void>;

  public abstract request<T = any>(params: EngineTypes.RequestParams<T>): Promise<any>;

  public abstract respond(params: EngineTypes.RespondParams): Promise<void>;

  public abstract emit(params: EngineTypes.EmitParams): Promise<void>;

  public abstract ping(params: EngineTypes.PingParams): Promise<void>;

  public abstract disconnect(params: EngineTypes.DisconnectParams): Promise<void>;
}
