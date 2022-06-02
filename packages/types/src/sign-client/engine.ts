import {
  JsonRpcResponse,
  JsonRpcRequest,
  ErrorResponse,
  JsonRpcResult,
  JsonRpcError,
} from "@walletconnect/jsonrpc-types";
import { ISignClient } from "./client";
import { RelayerTypes } from "../core/relayer";
import { SessionTypes } from "./session";
import { ProposalTypes } from "./proposal";
import { PairingTypes } from "./pairing";
import { JsonRpcTypes } from "./jsonrpc";
import { EventEmitter } from "events";

export declare namespace EngineTypes {
  type Event =
    | "session_connect"
    | "session_approve"
    | "session_update"
    | "session_extend"
    | "session_ping"
    | "pairing_ping"
    | "session_request";

  interface EventArguments {
    session_connect: {
      error?: ErrorResponse;
      session?: Omit<SessionTypes.Struct, "requiredNamespaces">;
    };
    session_approve: { error?: ErrorResponse };
    session_update: { error?: ErrorResponse };
    session_extend: { error?: ErrorResponse };
    session_ping: { error?: ErrorResponse };
    pairing_ping: { error?: ErrorResponse };
    session_request: { error?: ErrorResponse; result?: any };
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
    requiredNamespaces: ProposalTypes.RequiredNamespaces;
    pairingTopic?: string;
    relays?: RelayerTypes.ProtocolOptions[];
  }

  interface PairParams {
    uri: string;
  }

  interface ApproveParams {
    id: number;
    namespaces: SessionTypes.Namespaces;
    relayProtocol?: string;
  }

  interface RejectParams {
    id: number;
    reason: ErrorResponse;
  }

  interface UpdateParams {
    topic: string;
    namespaces: SessionTypes.Namespaces;
  }

  interface ExtendParams {
    topic: string;
  }

  interface RequestParams {
    topic: string;
    request: {
      method: string;
      params: any;
    };
    chainId: string;
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
    chainId: string;
  }

  interface PingParams {
    topic: string;
  }

  interface DisconnectParams {
    topic: string;
    reason: ErrorResponse;
  }

  interface FindParams {
    requiredNamespaces: ProposalTypes.RequiredNamespaces;
  }

  type AcknowledgedPromise = Promise<{ acknowledged: () => Promise<void> }>;
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

  deleteProposal(id: number): Promise<void>;

  setExpiry(topic: string, expiry: number): Promise<void>;

  setProposal(id: number, proposal: ProposalTypes.Struct): Promise<void>;

  cleanup(): Promise<void>;

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

  onSessionUpdateRequest(
    topic: string,
    payload: JsonRpcRequest<JsonRpcTypes.RequestParams["wc_sessionUpdate"]>,
  ): Promise<void>;

  onSessionUpdateResponse(
    topic: string,
    payload: JsonRpcResult<JsonRpcTypes.Results["wc_sessionUpdate"]> | JsonRpcError,
  ): void;

  onSessionExtendRequest(
    topic: string,
    payload: JsonRpcRequest<JsonRpcTypes.RequestParams["wc_sessionExtend"]>,
  ): Promise<void>;

  onSessionExtendResponse(
    topic: string,
    payload: JsonRpcResult<JsonRpcTypes.Results["wc_sessionExtend"]> | JsonRpcError,
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

  onPairingDeleteRequest(
    topic: string,
    payload: JsonRpcRequest<JsonRpcTypes.RequestParams["wc_pairingDelete"]>,
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
  ): Promise<void>;

  // -- Validators ---------------------------------------------------- //
  isValidConnect(params: EngineTypes.ConnectParams): Promise<void>;

  isValidPair(params: EngineTypes.PairParams): void;

  isValidApprove(params: EngineTypes.ApproveParams): void;

  isValidReject(params: EngineTypes.RejectParams): void;

  isValidUpdate(params: EngineTypes.UpdateParams): Promise<void>;

  isValidExtend(params: EngineTypes.ExtendParams): Promise<void>;

  isValidRequest(params: EngineTypes.RequestParams): Promise<void>;

  isValidRespond(params: EngineTypes.RespondParams): Promise<void>;

  isValidPing(params: EngineTypes.PingParams): Promise<void>;

  isValidEmit(params: EngineTypes.EmitParams): Promise<void>;

  isValidDisconnect(params: EngineTypes.DisconnectParams): Promise<void>;
}

// -- class interface ----------------------------------------------- //

export abstract class IEngine {
  constructor(public client: ISignClient) {}

  public abstract init(): Promise<void>;

  public abstract connect(
    params: EngineTypes.ConnectParams,
  ): Promise<{ uri?: string; approval: () => Promise<SessionTypes.Struct> }>;

  public abstract pair(params: EngineTypes.PairParams): Promise<PairingTypes.Struct>;

  public abstract approve(
    params: EngineTypes.ApproveParams,
  ): Promise<{ topic: string; acknowledged: () => Promise<SessionTypes.Struct> }>;

  public abstract reject(params: EngineTypes.RejectParams): Promise<void>;

  public abstract update(params: EngineTypes.UpdateParams): EngineTypes.AcknowledgedPromise;

  public abstract extend(params: EngineTypes.ExtendParams): EngineTypes.AcknowledgedPromise;

  public abstract request<T>(params: EngineTypes.RequestParams): Promise<T>;

  public abstract respond(params: EngineTypes.RespondParams): Promise<void>;

  public abstract emit(params: EngineTypes.EmitParams): Promise<void>;

  public abstract ping(params: EngineTypes.PingParams): Promise<void>;

  public abstract disconnect(params: EngineTypes.DisconnectParams): Promise<void>;

  public abstract find: (params: EngineTypes.FindParams) => SessionTypes.Struct[];
}
