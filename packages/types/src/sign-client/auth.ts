import {
  ErrorResponse,
  JsonRpcError,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcResult,
} from "@walletconnect/jsonrpc-types";
import { CoreTypes, ICore, IStore, Verify } from "../core";
import { SessionTypes } from "./session";

export declare namespace AuthTypes {
  type Event = "session_authenticate";

  interface AuthRequestEventArgs {
    requester: Participant;
    authPayload: PayloadParams;
    expiryTimestamp: number;
  }

  type AuthResponseEventArgs =
    | { message: string; code: number }
    | JsonRpcResult<Cacao>
    | JsonRpcError;

  interface BaseEventArgs<T = unknown> {
    id: number;
    topic: string;
    params: T;
    verifyContext?: Verify.Context;
  }

  interface EventArguments {
    auth_request: BaseEventArgs<AuthRequestEventArgs>;
    auth_response: BaseEventArgs<AuthResponseEventArgs>;
    sign_request: BaseEventArgs<{
      request: { method: string; params: any };
      chainId: string;
    }>;
    sign_response: BaseEventArgs<JsonRpcResult | JsonRpcError>;
  }

  interface Options extends CoreTypes.Options {
    metadata: Metadata;
    core?: ICore;
    projectId: string;
  }

  interface Metadata {
    name: string;
    description: string;
    url: string;
    icons: string[];
    redirect?: {
      native?: string;
      universal?: string;
    };
    verifyUrl?: string;
  }

  interface EventCallback<T extends JsonRpcRequest | JsonRpcResponse> {
    topic: string;
    payload: T;
  }

  /**
   * `aud` is used in protocol request
   * `uri` is more descriptive and is used in client APIs
   * formatMessageParams should accept either `aud` or `uri` as a parameter to construct the message
   */
  type FormatMessageParams = {
    aud?: string;
    uri?: string;
  } & Omit<BaseAuthRequestParams, "aud" | "chainId">;

  interface BaseAuthRequestParams {
    domain: string;
    aud: string;
    nonce: string;
    version?: string;
    iat?: string;
    nbf?: string;
    exp?: string;
    chainId?: string;
    statement?: string;
    requestId?: string;
    resources?: string[];
    expiry?: number;
    type?: string;
  }

  // https://github.com/ChainAgnostic/CAIPs/pull/74
  type RequestParams = {
    chains: string[];
  } & BaseAuthRequestParams;

  type SessionAuthenticateParams = {
    pairingTopic?: string;
    methods?: string[];
    uri: string;
  } & Omit<RequestParams, "aud">;

  type PayloadParams = {
    version: string;
    iat: string;
  } & RequestParams;

  type CacaoPayload = {
    iss: string;
  } & BaseAuthRequestParams;

  interface CacaoHeader {
    t: "caip122";
  }

  interface CacaoSignature {
    t: "eip191" | "eip1271";
    s: string;
    m?: string;
  }

  interface Cacao {
    h: CacaoHeader;
    p: CacaoPayload;
    s: CacaoSignature;
  }

  interface PendingRequest {
    id: number;
    pairingTopic: string;
    requester: Participant;
    expiryTimestamp: number;
    authPayload: PayloadParams;
    verifyContext: Verify.Context;
  }

  interface ApproveSessionAuthenticateParams {
    id: number;
    auths: Cacao[];
  }

  interface SessionAuthenticateResponseParams {
    responder: Participant;
    cacaos: Cacao[];
  }

  interface AuthErrorResponse {
    id: number;
    error: ErrorResponse;
  }

  type AuthResponse = SessionAuthenticateResponseParams["cacaos"];

  interface Participant {
    publicKey: string;
    metadata: Metadata;
  }

  interface SessionAuthenticateRequestParams {
    requester: Participant;
    authPayload: PayloadParams;
    expiryTimestamp: number;
  }

  interface SessionAuthenticateRequest extends SessionAuthenticateRequestParams {
    verifyContext: Verify.Context;
  }

  type AuthenticateResponseResult = {
    auths?: AuthTypes.AuthResponse;
    session: SessionTypes.Struct;
  };
}

export type IAuth = {
  init(): Promise<void>;
  authKeys: IStore<string, { responseTopic: string; publicKey: string }>;
  pairingTopics: IStore<string, { topic: string; pairingTopic: string }>;
  requests: IStore<number, AuthTypes.PendingRequest>;
};
