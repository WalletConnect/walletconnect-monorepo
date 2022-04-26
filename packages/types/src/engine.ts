import {
  JsonRpcResponse,
  JsonRpcRequest,
  ErrorResponse,
  JsonRpcResult,
  JsonRpcError,
} from "@walletconnect/jsonrpc-types";
import { IClient } from "./client";
import { RelayerTypes } from "./relayer";
import { SessionTypes } from "./session";
import { PairingTypes } from "./pairing";
import { JsonRpcTypes } from "./jsonrpc";
import { EventEmitter } from "events";

export declare namespace EngineTypes {
  type Event =
    | "connect"
    | "approve"
    | "update_accounts"
    | "update_namespaces"
    | "update_expiry"
    | "session_ping"
    | "pairing_ping"
    | "session_delete"
    | "pairing_delete"
    | "request";

  interface EventArguments {
    connect: { error?: ErrorResponse; data?: SessionTypes.Struct };
    approve: { error?: ErrorResponse };
    update_accounts: { error?: ErrorResponse };
    update_namespaces: { error?: ErrorResponse };
    update_expiry: { error?: ErrorResponse };
    session_ping: { error?: ErrorResponse };
    pairing_ping: { error?: ErrorResponse };
    session_delete: { error?: ErrorResponse };
    pairing_delete: { error?: ErrorResponse };
    request: { error?: ErrorResponse; data?: JsonRpcResponse };
  }

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

  interface ConnectParams {
    pairingTopic?: string;
    namespaces?: SessionTypes.Namespace[];
    relays?: RelayerTypes.ProtocolOptions[];
  }

  interface PairParams {
    uri: string;
  }

  interface ApproveParams {
    id: number;
    accounts: SessionTypes.Accounts;
    namespaces: SessionTypes.Namespace[];
    relayProtocol?: string;
  }

  interface RejectParams {
    id: number;
    reason: ErrorResponse;
  }

  interface UpdateAccountsParams {
    topic: string;
    accounts: SessionTypes.Accounts;
  }

  interface UpdateNamespacesParams {
    topic: string;
    namespaces: SessionTypes.Namespace[];
  }

  interface UpdateExpiryParams {
    topic: string;
    expiry: SessionTypes.Expiry;
  }

  interface RequestParams {
    topic: string;
    request: {
      method: string;
      params: any;
    };
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

export abstract class IEngineEvents extends EventEmitter {
  constructor() {
    super();
  }

  public abstract emit: <E extends EngineTypes.Event>(
    event: string,
    args: EngineTypes.EventArguments[E],
  ) => boolean;

  public abstract once: <E extends EngineTypes.Event>(
    event: string,
    listener: (args: EngineTypes.EventArguments[E]) => any,
  ) => this;
}

// -- private method interface -------------------------------------- //

export interface EnginePrivate {
  sendRequest<M extends JsonRpcTypes.WcMethod>(
    topic: string,
    method: M,
    params: JsonRpcTypes.RequestParams[M],
  ): Promise<number>;

  sendResult<M extends JsonRpcTypes.WcMethod>(
    id: number,
    topic: string,
    result: JsonRpcTypes.Results[M],
  ): Promise<void>;

  sendError(id: number, topic: string, error: JsonRpcTypes.Error): Promise<void>;

  onRelayEventRequest(event: EngineTypes.EventCallback<JsonRpcRequest>): void;

  onRelayEventResponse(event: EngineTypes.EventCallback<JsonRpcResponse>): Promise<void>;

  activatePairing(topic: string): Promise<void>;

  deleteSession(topic: string): Promise<void>;

  deletePairing(topic: string): Promise<void>;

  onSessionProposeRequest(
    topic: string,
    payload: JsonRpcRequest<JsonRpcTypes.RequestParams["wc_sessionPropose"]>,
  ): Promise<void>;

  onSessionProposeResponse(
    topic: string,
    payload: JsonRpcResult<JsonRpcTypes.Results["wc_sessionPropose"]> | JsonRpcError,
  ): Promise<void>;

  onSessionSettleRequest(
    topic: string,
    payload: JsonRpcRequest<JsonRpcTypes.RequestParams["wc_sessionSettle"]>,
  ): Promise<void>;

  onSessionSettleResponse(
    topic: string,
    payload: JsonRpcResult<JsonRpcTypes.Results["wc_sessionSettle"]> | JsonRpcError,
  ): Promise<void>;

  onSessionUpdateAccountsRequest(
    topic: string,
    payload: JsonRpcRequest<JsonRpcTypes.RequestParams["wc_sessionUpdateAccounts"]>,
  ): Promise<void>;

  onSessionUpdateAccountsResponse(
    topic: string,
    payload: JsonRpcResult<JsonRpcTypes.Results["wc_sessionUpdateAccounts"]> | JsonRpcError,
  ): void;

  onSessionUpdateNamespacesRequest(
    topic: string,
    payload: JsonRpcRequest<JsonRpcTypes.RequestParams["wc_sessionUpdateNamespaces"]>,
  ): Promise<void>;

  onSessionUpdateNamespacesResponse(
    topic: string,
    payload: JsonRpcResult<JsonRpcTypes.Results["wc_sessionUpdateNamespaces"]> | JsonRpcError,
  ): void;

  onSessionUpdateExpiryRequest(
    topic: string,
    payload: JsonRpcRequest<JsonRpcTypes.RequestParams["wc_sessionUpdateExpiry"]>,
  ): Promise<void>;

  onSessionUpdateExpiryResponse(
    topic: string,
    payload: JsonRpcResult<JsonRpcTypes.Results["wc_sessionUpdateExpiry"]> | JsonRpcError,
  ): void;

  onSessionPingRequest(
    topic: string,
    payload: JsonRpcRequest<JsonRpcTypes.RequestParams["wc_sessionPing"]>,
  ): Promise<void>;

  onSessionPingResponse(
    topic: string,
    payload: JsonRpcResult<JsonRpcTypes.Results["wc_sessionPing"]> | JsonRpcError,
  ): void;

  onPairingPingRequest(
    topic: string,
    payload: JsonRpcRequest<JsonRpcTypes.RequestParams["wc_pairingPing"]>,
  ): Promise<void>;

  onPairingPingResponse(
    topic: string,
    payload: JsonRpcResult<JsonRpcTypes.Results["wc_pairingPing"]> | JsonRpcError,
  ): void;

  onSessionDeleteRequest(
    topic: string,
    payload: JsonRpcRequest<JsonRpcTypes.RequestParams["wc_sessionDelete"]>,
  ): Promise<void>;

  onSessionDeleteResponse(
    topic: string,
    payload: JsonRpcResult<JsonRpcTypes.Results["wc_sessionDelete"]> | JsonRpcError,
  ): Promise<void>;

  onPairingDeleteRequest(
    topic: string,
    payload: JsonRpcRequest<JsonRpcTypes.RequestParams["wc_pairingDelete"]>,
  ): Promise<void>;

  onPairingDeleteResponse(
    topic: string,
    payload: JsonRpcResult<JsonRpcTypes.Results["wc_pairingDelete"]> | JsonRpcError,
  ): Promise<void>;

  onSessionRequest(
    topic: string,
    payload: JsonRpcRequest<JsonRpcTypes.RequestParams["wc_sessionRequest"]>,
  ): Promise<void>;

  onSessionRequestResponse(
    topic: string,
    payload: JsonRpcResult<JsonRpcTypes.Results["wc_sessionRequest"]> | JsonRpcError,
  ): void;

  onSessionEventRequest(
    topic: string,
    payload: JsonRpcRequest<JsonRpcTypes.RequestParams["wc_sessionEvent"]>,
  ): void;
}

// -- class interface ----------------------------------------------- //

export abstract class IEngine {
  constructor(public client: IClient) {}

  public abstract connect(
    params: EngineTypes.ConnectParams,
  ): Promise<{ uri?: string; approval: () => Promise<SessionTypes.Struct> }>;

  public abstract pair(params: EngineTypes.PairParams): Promise<PairingTypes.Struct>;

  public abstract approve(
    params: EngineTypes.ApproveParams,
  ): Promise<{ topic: string; acknowledged: () => Promise<SessionTypes.Struct> }>;

  public abstract reject(params: EngineTypes.RejectParams): Promise<void>;

  public abstract updateAccounts(params: EngineTypes.UpdateAccountsParams): Promise<void>;

  public abstract updateNamespaces(params: EngineTypes.UpdateNamespacesParams): Promise<void>;

  public abstract updateExpiry(params: EngineTypes.UpdateExpiryParams): Promise<void>;

  public abstract request(params: EngineTypes.RequestParams): Promise<JsonRpcResponse>;

  public abstract respond(params: EngineTypes.RespondParams): Promise<void>;

  public abstract emit(params: EngineTypes.EmitParams): Promise<void>;

  public abstract ping(params: EngineTypes.PingParams): Promise<void>;

  public abstract disconnect(params: EngineTypes.DisconnectParams): Promise<void>;
}
