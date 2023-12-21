import {
  ErrorResponse,
  JsonRpcError,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcResult,
} from "@walletconnect/jsonrpc-types";
import { CoreTypes, ICore, IStore, Verify } from "../core";

export declare namespace AuthTypes {
  type Event = "session_authenticate";

  interface AuthRequestEventArgs {
    requester: Participant;
    authPayload: PayloadParams;
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

  // https://github.com/ChainAgnostic/CAIPs/pull/74
  interface RequestParams {
    chains: string[];
    domain: string;
    nonce: string;
    aud: string;
    type?: CacaoHeader["t"];
    nbf?: string;
    exp?: string;
    statement?: string;
    requestId?: string;
    resources?: string[];
    expiry?: number;
  }

  type SessionAuthenticateParams = {
    pairingTopic?: string;
    methods?: string[];
  } & RequestParams;

  type PayloadParams = {
    version: string;
    iat: string;
  } & RequestParams;

  interface CacaoPayload {
    iss: string;
    domain: string;
    aud: string;
    version: string;
    nonce: string;
    iat: string;
    nbf?: string;
    exp?: string;
    chainId?: string;
    statement?: string;
    requestId?: string;
    resources?: string[];
  }

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

  type AuthResponse = SessionAuthenticateResponseParams | AuthErrorResponse;

  interface Participant {
    publicKey: string;
    metadata: Metadata;
  }

  interface SessionAuthenticateRequestParams {
    requester: Participant;
    authPayload: PayloadParams;
  }
}

export type IAuth = {
  authKeys: IStore<string, { responseTopic: string; publicKey: string }>;
  pairingTopics: IStore<string, { topic: string; pairingTopic: string }>;
  requests: IStore<number, AuthTypes.PendingRequest>;
};
