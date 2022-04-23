import { Client } from "@walletconnect/client";
import { IJsonRpcConnection } from "@walletconnect/jsonrpc-types";
import { formatJsonRpcError, formatJsonRpcResult } from "@walletconnect/jsonrpc-utils";
import { ClientTypes, IClient, SessionTypes } from "@walletconnect/types";
import { ERROR } from "@walletconnect/utils";
import { EventEmitter } from "events";

function isClient(opts?: SignerConnectionClientOpts): opts is IClient {
  return typeof opts !== "undefined" && typeof (opts as IClient).context !== "undefined";
}

export const SIGNER_EVENTS = {
  init: "signer_init",
  uri: "signer_uri",
  created: "signer_created",
  updated: "signer_updated",
  deleted: "signer_deleted",
  event: "signer_event",
};

export type SignerConnectionClientOpts = IClient | ClientTypes.Options;
export interface SignerConnectionOpts {
  chains?: string[];
  methods?: string[];
  client?: SignerConnectionClientOpts;
}

export class SignerConnection extends IJsonRpcConnection {
  public events: any = new EventEmitter();

  public chains: string[];
  public methods: string[];

  private pending = false;
  private session: SessionTypes.Struct | undefined;

  private opts: SignerConnectionClientOpts | undefined;

  private client: IClient | undefined;
  private initializing = false;

  constructor(opts?: SignerConnectionOpts) {
    super();

    this.chains = opts?.chains || [];
    this.methods = opts?.methods || [];
    this.opts = opts?.client;
  }

  get connected(): boolean {
    return typeof this.session !== "undefined";
  }

  get connecting(): boolean {
    return this.pending;
  }

  get accounts() {
    return this.session?.accounts || [];
  }

  public on(event: string, listener: any) {
    this.events.on(event, listener);
  }

  public once(event: string, listener: any) {
    this.events.once(event, listener);
  }

  public off(event: string, listener: any) {
    this.events.off(event, listener);
  }

  public removeListener(event: string, listener: any) {
    this.events.removeListener(event, listener);
  }

  public async open(): Promise<void> {
    if (this.pending) {
      return new Promise((resolve, reject) => {
        this.events.once("open", () => {
          this.events.once("open_error", (error: any) => {
            reject(error);
          });
          if (typeof this.client === "undefined") {
            return reject(new Error("Client not initialized"));
          }
          resolve();
        });
      });
    }

    try {
      this.pending = true;
      const client = await this.register();
      const compatible = await client.session.find({
        chains: this.chains,
        methods: this.methods,
      });
      if (compatible.length) return this.onOpen(compatible[0]);
      const { uri, approval } = await client.connect({
        chains: this.chains,
        methods: this.methods,
      });
      this.events.emit(SIGNER_EVENTS.uri, { uri });
      this.session = await approval();
      this.onOpen();
    } catch (e) {
      this.events.emit("open_error", e);
      throw e;
    }
  }

  public async close() {
    if (typeof this.session === "undefined") {
      return;
    }
    const client = await this.register();
    await client.disconnect({
      topic: this.session.topic,
      reason: ERROR.USER_DISCONNECTED.format(),
    });
    this.onClose();
  }

  public async send(payload: any, context?: any) {
    if (typeof this.client === "undefined") {
      this.client = await this.register();
      if (!this.connected) await this.open();
    }
    if (typeof this.session === "undefined") {
      throw new Error("Signer connection is missing session");
    }
    this.client
      .request({ topic: this.session.topic, request: payload, chainId: context?.chainId })
      .then((result: any) => this.events.emit("payload", formatJsonRpcResult(payload.id, result)))
      .catch(e => this.events.emit("payload", formatJsonRpcError(payload.id, e.message)));
  }

  // ---------- Private ----------------------------------------------- //

  private async register(
    opts: SignerConnectionClientOpts | undefined = this.opts,
  ): Promise<IClient> {
    if (typeof this.client !== "undefined") {
      return this.client;
    }

    if (this.initializing) {
      return new Promise((resolve, reject) => {
        this.events.once("register_error", (error: any) => {
          reject(error);
        });
        this.events.once(SIGNER_EVENTS.init, () => {
          if (typeof this.client === "undefined") {
            return reject(new Error("Client not initialized"));
          }
          resolve(this.client);
        });
      });
    }
    if (isClient(opts)) {
      this.client = opts;
      this.registerEventListeners();
      return this.client;
    }
    try {
      this.initializing = true;
      this.client = await Client.init(opts);
      this.initializing = false;
      this.registerEventListeners();
      this.events.emit(SIGNER_EVENTS.init);
      return this.client;
    } catch (e) {
      this.events.emit("register_error", e);
      throw e;
    }
  }

  private onOpen(session?: SessionTypes.Struct) {
    this.pending = false;
    if (session) {
      this.session = session;
    }
    this.events.emit("open");
  }

  private onClose() {
    this.pending = false;
    if (this.client) {
      this.client = undefined;
    }
    this.events.emit("close");
  }

  private registerEventListeners() {
    if (typeof this.client === "undefined") return;
    // TODO(pedro) - add event handlers to IClient interface
    // @ts-ignore
    this.client.on(
      "session_created",
      // TODO(pedro) - add session created event
      (session: SessionTypes.Struct) => {
        if (this.session && this.session?.topic !== session.topic) return;
        this.session = session;
        this.events.emit(SIGNER_EVENTS.created, session);
      },
    );
    // TODO(pedro) - add event handlers to IClient interface
    // @ts-ignore
    this.client.on(
      "session_updated",
      // TODO(pedro) - add session updated event
      (session: SessionTypes.Struct) => {
        if (this.session && this.session?.topic !== session.topic) return;
        this.session = session;
        this.events.emit(SIGNER_EVENTS.updated, session);
      },
    );
    // TODO(pedro) - add event handlers to IClient interface
    // @ts-ignore
    this.client.on(
      "session_event",
      // TODO(pedro) - add session event event
      (sessionEvent: any) => {
        if (this.session && this.session?.topic !== sessionEvent.topic) return;
        this.events.emit(SIGNER_EVENTS.event, sessionEvent.event);
      },
    );
    // TODO(pedro) - add event handlers to IClient interface
    // @ts-ignore
    this.client.on(
      // TODO(pedro) - add session deleted event
      "session_deleted",
      (session: SessionTypes.Struct) => {
        if (!this.session) return;
        if (this.session && this.session?.topic !== session.topic) return;
        this.onClose();

        this.events.emit(SIGNER_EVENTS.deleted, session);
        this.session = undefined;
      },
    );
  }
}

export default SignerConnection;
