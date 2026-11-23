import decompress from "brotli/decompress";
import type { IKeyValueStorage } from "@walletconnect/keyvaluestorage";
import type {
  EngineTypes,
  PairingTypes,
  ProposalTypes,
  SessionTypes,
  SignClientTypes,
  Verify,
} from "@walletconnect/types";

import { SIGN_V3_WASM } from "./wasm/wasm-data.js";
import { WasmSignClient, initSync } from "./wasm/sign_v3.js";
import { unverified, withoutIdentity } from "../verification.js";

const STORAGE_PREFIX = "wc@3:";

export interface V3ClientOptions {
  projectId?: string;
  relayUrl?: string;
  metadata: SignClientTypes.Metadata;
  storage: IKeyValueStorage;
  customStoragePrefix?: string;
  /**
   * Verify v4, dApp: signs the proposal and every message. The SDK calls it before creating the
   * connection and before every send, and sends the JWT as `appSignature`. If it throws, the
   * call fails; nothing is sent unsigned. Without it, nothing is signed.
   */
  appSignature?: Verify.AppSignatureOptions;
}

// The SDK's own shapes, as its JSON interface returns them.
interface V3Session {
  topic: string;
  role: "dapp" | "wallet";
  namespaces: SessionTypes.Namespaces;
  /** dApp side: the wallet's metadata. */
  walletMetadata?: SignClientTypes.Metadata;
  /** Wallet side: the dApp's, without its self-asserted identity. */
  dappMetadata?: SignClientTypes.PeerMetadata;
  /** Wallet side: the proposal's App Verification. */
  verification?: Verify.AppVerification;
  expiry: number;
}
interface V3Proposal {
  id: string;
  proposalId: number;
  params: {
    requiredNamespaces?: ProposalTypes.RequiredNamespaces;
    optionalNamespaces?: ProposalTypes.OptionalNamespaces;
    sessionProperties?: ProposalTypes.SessionProperties;
    scopedProperties?: ProposalTypes.ScopedProperties;
  };
  metadata: SignClientTypes.PeerMetadata;
  expiresAt: number;
  verification: Verify.AppVerification;
}
type V3Event = { type: string } & Record<string, any>;
type Waiter = { resolve: (s: SessionTypes.Struct) => void; reject: (e: unknown) => void };

/** An error from the v3 SDK: `code` is its own, such as `message_expired` or `not_found`. */
export class SignV3Error extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message ? `${code}: ${message}` : code);
  }
}

// v2's SDK errors that apps match on, as @walletconnect/utils getSdkError returns them.
const USER_REJECTED = { code: 5000, message: "User rejected." };
const EXPIRED = 6;

let wasmLoaded = false;

// Decompressed and compiled once per process, on the first client.
function loadWasm() {
  if (wasmLoaded) return;
  const compressed = Uint8Array.from(atob(SIGN_V3_WASM), (c) => c.charCodeAt(0));
  // @types/brotli says Buffer; a Uint8Array is all it reads, so browsers need no Buffer.
  initSync({ module: new Uint8Array(decompress(compressed as unknown as Buffer)) });
  wasmLoaded = true;
}

type Emit = <E extends SignClientTypes.Event>(
  name: E,
  args: SignClientTypes.EventArguments[E],
) => void;

/**
 * Sign v2's SignClient API over the Sign v3 SDK, compiled from Rust to WASM: v2's methods and
 * events, with the v3 protocol underneath. `SignClient` uses it for v3 connections.
 *
 * v3 has no counterpart for some v2 fields, so they are filled in:
 * - the pairing topic is the connection id, which is also the session topic;
 * - public keys are empty;
 * - `verification` comes from Verify v4: the app's signature, checked by the Relay and the SDK,
 *   and the Relay's `appMetadata`. Wallets never see the dApp's own name, url or icons: a wallet
 *   session's `peer.metadata` has them empty.
 * - a session doesn't keep the proposal's required and optional namespaces.
 */
export class V3Client {
  private wasm!: WasmSignClient;
  private readonly sessions = new Map<string, SessionTypes.Struct>();
  private readonly proposals = new Map<number, string>(); // v2 proposal id → v3 connection id
  private readonly approvals = new Map<string, Waiter>();

  /** v2's `client.session` store, read-only. */
  public readonly session = sessionStore(this.sessions);

  /** `dispatch` receives the events, named and shaped as v2's. */
  static async init(opts: V3ClientOptions, dispatch: Emit) {
    const client = new V3Client(opts, dispatch);
    await client.initialize();
    return client;
  }

  private constructor(
    private readonly opts: V3ClientOptions,
    private readonly dispatch: Emit,
  ) {
    if (!opts.projectId) throw new Error("projectId is required");
    if (!opts.relayUrl) throw new Error("relayUrl is required");
  }

  // ---------- dApp ------------------------------------------------- //

  public connect = async (
    params: EngineTypes.ConnectParams,
  ): Promise<{ uri?: string; approval: () => Promise<SessionTypes.Struct> }> => {
    const { uri, topic } = await this.call<{ uri: string; topic: string }>("connect", {
      params: {
        requiredNamespaces: params.requiredNamespaces ?? {},
        optionalNamespaces: params.optionalNamespaces,
        sessionProperties: params.sessionProperties,
        scopedProperties: params.scopedProperties,
      },
    });
    const approval = new Promise<SessionTypes.Struct>((resolve, reject) =>
      this.approvals.set(topic, { resolve, reject }),
    );
    approval.catch(() => undefined);
    return { uri, approval: () => approval };
  };

  // ---------- Wallet ----------------------------------------------- //

  public hasProposal = (id: number) => this.proposals.has(id);

  /** Resolves with the pairing; the proposal arrives as `session_proposal`, as in v2. */
  public pair = async (params: { uri: string }): Promise<PairingTypes.Struct> => {
    const p = await this.call<V3Proposal>("pair", { uri: params.uri });
    return {
      topic: p.id,
      expiry: p.expiresAt,
      relay: { protocol: "irn" },
      active: false,
      peerMetadata: withoutIdentity(p.metadata),
    };
  };

  public approve = async (
    params: EngineTypes.ApproveParams,
  ): Promise<{ topic: string; acknowledged: () => Promise<SessionTypes.Struct> }> => {
    const s = await this.call<V3Session>("approve", {
      topic: this.proposalTopic(params.id),
      namespaces: params.namespaces,
    });
    this.proposals.delete(params.id);
    const session = this.keep(s);
    return { topic: session.topic, acknowledged: () => Promise.resolve(session) };
  };

  public reject = async (params: EngineTypes.RejectParams): Promise<void> => {
    await this.call("reject", { topic: this.proposalTopic(params.id), reason: "user_rejected" });
    this.proposals.delete(params.id);
  };

  // ---------- Session ---------------------------------------------- //

  /** Rejects with the peer's `{ code, message }`, or an Error with code 6 past `expiry`. */
  public request = async <T = unknown>(params: EngineTypes.RequestParams): Promise<T> => {
    try {
      return await this.call<T>("request", {
        topic: params.topic,
        chainId: params.chainId,
        request: params.request,
        deadlineS: params.expiry,
      });
    } catch (e) {
      if (e instanceof SignV3Error && e.code === "rpc_error") {
        throw JSON.parse(e.message.slice("rpc_error: ".length));
      }
      if (e instanceof SignV3Error && e.code === "message_expired") {
        throw Object.assign(new Error("Request expired. Please try again."), { code: EXPIRED });
      }
      throw e;
    }
  };

  public respond = async (params: EngineTypes.RespondParams): Promise<void> => {
    const r = params.response as {
      id: number;
      result?: unknown;
      error?: { code: number; message: string };
    };
    await this.call("respond", {
      topic: params.topic,
      id: r.id,
      ...(r.error ? { error: r.error } : { result: r.result }),
    });
  };

  /** Sends a session event to the peer. */
  public emit = async (params: EngineTypes.EmitParams): Promise<void> => {
    await this.call("emit", { topic: params.topic, chainId: params.chainId, event: params.event });
  };

  public ping = async (params: EngineTypes.PingParams): Promise<void> => {
    await this.call("ping", { topic: params.topic });
  };

  public update = async (params: EngineTypes.UpdateParams): EngineTypes.AcknowledgedPromise => {
    await this.call("update", { topic: params.topic, namespaces: params.namespaces });
    const s = this.sessions.get(params.topic);
    if (s) s.namespaces = params.namespaces;
    return { acknowledged: () => Promise.resolve() };
  };

  public extend = async (params: EngineTypes.ExtendParams): EngineTypes.AcknowledgedPromise => {
    await this.call("extend", { topic: params.topic });
    await this.refreshSessions();
    return { acknowledged: () => Promise.resolve() };
  };

  public disconnect = async (params: EngineTypes.DisconnectParams): Promise<void> => {
    try {
      await this.call("disconnect", { topic: params.topic });
    } finally {
      this.sessions.delete(params.topic);
    }
  };

  // ---------- Private ---------------------------------------------- //

  private async initialize() {
    loadWasm();
    const relay = (this.opts.relayUrl as string)
      .replace(/^wss:/, "https:")
      .replace(/^ws:/, "http:");
    const config = {
      hosts: [relay],
      projectId: this.opts.projectId,
      metadata: this.opts.metadata,
      storagePrefix: STORAGE_PREFIX + (this.opts.customStoragePrefix ?? ""),
    };
    const kv = this.opts.storage;
    // v2's KeyValueStorage parses the values it returns and turns "/" and "\" in keys into ":".
    // Keys are escaped and values wrapped, so both come back exactly as the SDK wrote them.
    const storage = {
      get: async (k: string) => (await kv.getItem<{ v: string }>(escapeKey(k)))?.v ?? null,
      set: (k: string, v: string) => kv.setItem(escapeKey(k), { v }),
      remove: (k: string) => kv.removeItem(escapeKey(k)),
      keys: async (prefix: string) =>
        (await kv.getKeys()).map(unescapeKey).filter((k) => k.startsWith(prefix)),
    };
    this.wasm = await WasmSignClient.create(JSON.stringify(config), storage, (json: string) =>
      this.onV3Event(JSON.parse(json)),
    );
    const appSignature = this.opts.appSignature;
    if (appSignature) this.wasm.setAppSigner(appSigner(appSignature));
    await this.refreshSessions();
    this.wasm.start();
    if (typeof document !== "undefined" && typeof addEventListener === "function") {
      const wake = () => document.visibilityState === "visible" && this.wasm.foreground();
      for (const ev of ["visibilitychange", "online", "pageshow"]) addEventListener(ev, wake);
    }
  }

  private async call<T = unknown>(method: string, params: object): Promise<T> {
    try {
      return JSON.parse(await this.wasm.call(method, JSON.stringify(params))) as T;
    } catch (e) {
      if (typeof e !== "string") throw e;
      const { code, message } = JSON.parse(e) as { code: string; message: string };
      throw new SignV3Error(code, message);
    }
  }

  private proposalTopic(id: number): string {
    const topic = this.proposals.get(id);
    if (!topic) throw new Error(`No matching key. proposal id doesn't exist: ${id}`);
    return topic;
  }

  private keep(s: V3Session): SessionTypes.Struct {
    const namespaces = Object.fromEntries(
      Object.entries(s.namespaces).map(([k, ns]) => [k, { ...ns, accounts: ns.accounts ?? [] }]),
    );
    const session: SessionTypes.Struct = {
      topic: s.topic,
      pairingTopic: s.topic,
      relay: { protocol: "irn" },
      expiry: s.expiry,
      acknowledged: true,
      controller: "",
      namespaces,
      requiredNamespaces: {},
      optionalNamespaces: {},
      self: { publicKey: "", metadata: this.opts.metadata },
      peer: {
        publicKey: "",
        metadata:
          s.role === "wallet"
            ? withoutIdentity(s.dappMetadata)
            : (s.walletMetadata as SignClientTypes.Metadata),
      },
      ...(s.role === "wallet" && { verification: s.verification ?? unverified() }),
    };
    this.sessions.set(session.topic, session);
    return session;
  }

  private async refreshSessions() {
    const list = await this.call<V3Session[]>("getSessions", {});
    this.sessions.clear();
    for (const s of list) this.keep(s);
  }

  private settle(topic: string, error: { code: number; message: string }) {
    this.approvals.get(topic)?.reject(error);
    this.approvals.delete(topic);
  }

  private onV3Event(e: V3Event) {
    switch (e.type) {
      case "session_proposal": {
        const p = e.proposal as V3Proposal;
        this.proposals.set(p.proposalId, p.id);
        const params: ProposalTypes.WalletStruct = {
          id: p.proposalId,
          expiryTimestamp: p.expiresAt,
          relays: [{ protocol: "irn" }],
          proposer: { publicKey: "", metadata: p.metadata },
          requiredNamespaces: p.params.requiredNamespaces ?? {},
          optionalNamespaces: p.params.optionalNamespaces ?? {},
          sessionProperties: p.params.sessionProperties,
          scopedProperties: p.params.scopedProperties,
          pairingTopic: p.id,
        };
        this.dispatch("session_proposal", {
          id: p.proposalId,
          params,
          verification: p.verification ?? unverified(),
        });
        break;
      }
      case "session_connect": {
        const session = this.keep(e.session);
        this.approvals.get(session.topic)?.resolve(session);
        this.approvals.delete(session.topic);
        this.dispatch("session_connect", { session });
        break;
      }
      case "proposal_rejected":
        this.settle(
          e.topic,
          e.reason === "user_rejected" || !e.reason
            ? USER_REJECTED
            : { code: USER_REJECTED.code, message: e.reason },
        );
        break;
      case "proposal_expire":
        this.settle(e.topic, {
          code: EXPIRED,
          message: e.reason === "replaced" ? "Replaced by a newer connect()." : "Proposal expired",
        });
        break;
      case "proposal_failed":
        this.settle(e.topic, {
          code: USER_REJECTED.code,
          message: `The wallet's answer failed verification: ${e.reason}`,
        });
        break;
      case "session_request":
        this.dispatch("session_request", {
          id: e.id,
          topic: e.topic,
          params: { request: e.request, chainId: e.chainId },
          verification: e.verification ?? unverified(),
        });
        break;
      case "session_event":
        this.dispatch("session_event", {
          id: e.id,
          topic: e.topic,
          params: { event: e.event, chainId: e.chainId },
        });
        break;
      case "session_update": {
        const s = this.sessions.get(e.topic);
        if (s) s.namespaces = e.namespaces;
        this.dispatch("session_update", {
          id: e.id,
          topic: e.topic,
          params: { namespaces: e.namespaces },
        });
        break;
      }
      case "session_extend": {
        const s = this.sessions.get(e.topic);
        if (s) s.expiry = e.expiry;
        this.dispatch("session_extend", { id: e.id, topic: e.topic });
        break;
      }
      case "session_ping":
        this.dispatch("session_ping", { id: e.id, topic: e.topic });
        break;
      case "app_signature_mismatch":
        this.dispatch("app_signature_mismatch", {
          topic: e.topic,
          ...(e.id != null && { id: e.id }),
          ...(e.method != null && { method: e.method }),
        });
        break;
      case "session_delete":
        this.sessions.delete(e.topic);
        if (e.reason === "expired") this.dispatch("session_expire", { topic: e.topic });
        else this.dispatch("session_delete", { id: 0, topic: e.topic });
        break;
    }
  }
}

/** The WASM side calls it with `{ request, ciphertextHash }` as JSON, `request` being JSON text. */
function appSigner(opts: Verify.AppSignatureOptions) {
  return async (input: string): Promise<string> => {
    const { request, ciphertextHash } = JSON.parse(input) as {
      request: string;
      ciphertextHash?: string | null;
    };
    const res = await opts.callback({
      request: JSON.parse(request),
      requestJson: request,
      ciphertextHash: ciphertextHash ?? null,
    });
    if (typeof res?.appSignature !== "string" || !res.appSignature) {
      throw new Error("appSignature.callback returned no appSignature");
    }
    return res.appSignature;
  };
}

const escapeKey = (k: string) => k.replace(/%/g, "%25").replace(/\//g, "%2F").replace(/\\/g, "%5C");
const unescapeKey = (k: string) =>
  k.replace(/%2F/g, "/").replace(/%5C/g, "\\").replace(/%25/g, "%");

function sessionStore(sessions: Map<string, SessionTypes.Struct>) {
  return {
    getAll: (): SessionTypes.Struct[] => [...sessions.values()],
    get: (topic: string): SessionTypes.Struct => {
      const s = sessions.get(topic);
      if (!s) throw new Error(`No matching key. session topic doesn't exist: ${topic}`);
      return s;
    },
    get keys(): string[] {
      return [...sessions.keys()];
    },
  };
}
