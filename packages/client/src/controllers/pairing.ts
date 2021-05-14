import { EventEmitter } from "events";
import { Logger } from "pino";
import { generateChildLogger } from "@pedrouid/pino-utils";
import {
  PairingTypes,
  IClient,
  IPairing,
  SubscriptionEvent,
  CryptoTypes,
} from "@walletconnect/types";
import {
  generateRandomBytes32,
  isPairingFailed,
  isPairingResponded,
  formatUri,
  isSubscriptionUpdatedEvent,
  ERROR,
  getError,
} from "@walletconnect/utils";
import {
  JsonRpcPayload,
  JsonRpcRequest,
  JsonRpcResponse,
  formatJsonRpcError,
  formatJsonRpcRequest,
  formatJsonRpcResult,
  isJsonRpcError,
  isJsonRpcRequest,
  ErrorResponse,
} from "@json-rpc-tools/utils";

import { Subscription } from "./subscription";
import { JsonRpcHistory } from "./history";
import {
  PAIRING_CONTEXT,
  PAIRING_EVENTS,
  PAIRING_JSONRPC,
  PAIRING_STATUS,
  SUBSCRIPTION_EVENTS,
  RELAYER_DEFAULT_PROTOCOL,
  PAIRING_SIGNAL_METHOD_URI,
  SESSION_JSONRPC,
  PAIRING_DEFAULT_TTL,
} from "../constants";
import { Engine } from "./engine";

export class Pairing extends IPairing {
  public pending: Subscription<PairingTypes.Pending>;
  public settled: Subscription<PairingTypes.Settled>;
  public history: JsonRpcHistory;

  public events = new EventEmitter();

  public context: string = PAIRING_CONTEXT;

  public config = {
    status: PAIRING_STATUS,
    events: PAIRING_EVENTS,
    jsonrpc: PAIRING_JSONRPC,
  };

  private engine: Engine;

  constructor(public client: IClient, public logger: Logger) {
    super(client, logger);
    this.logger = generateChildLogger(logger, this.context);
    this.pending = new Subscription<PairingTypes.Pending>(
      client,
      this.logger,
      this.config.status.pending,
    );
    this.settled = new Subscription<PairingTypes.Settled>(
      client,
      this.logger,
      this.config.status.settled,
    );
    this.history = new JsonRpcHistory(client, this.logger);
    this.engine = new Engine(this);
    this.registerEventListeners();
  }

  public async init(): Promise<void> {
    this.logger.trace(`Initialized`);
    await this.pending.init();
    await this.settled.init();
    await this.history.init();
  }

  public async get(topic: string): Promise<PairingTypes.Settled> {
    return this.settled.get(topic);
  }

  public async ping(topic: string, timeout?: number): Promise<void> {
    return this.engine.ping(topic, timeout);
  }

  public async send(topic: string, payload: JsonRpcPayload): Promise<void> {
    return this.engine.send(topic, payload);
  }

  get length(): number {
    return this.settled.length;
  }

  get topics(): string[] {
    return this.settled.topics;
  }

  get values(): PairingTypes.Settled[] {
    return this.settled.values.map(x => x.data);
  }

  public create(params?: PairingTypes.CreateParams): Promise<PairingTypes.Settled> {
    return this.engine.create(params);
  }

  public async respond(params: PairingTypes.RespondParams): Promise<PairingTypes.Pending> {
    return this.engine.respond(params);
  }

  public async upgrade(params: PairingTypes.UpgradeParams): Promise<PairingTypes.Settled> {
    return this.engine.upgrade(params);
  }

  public async update(params: PairingTypes.UpdateParams): Promise<PairingTypes.Settled> {
    return this.engine.update(params);
  }

  public async request(params: PairingTypes.RequestParams): Promise<any> {
    return this.engine.request(params);
  }

  public async delete(params: PairingTypes.DeleteParams): Promise<void> {
    return this.engine.delete(params);
  }

  public on(event: string, listener: any): void {
    this.events.on(event, listener);
  }

  public once(event: string, listener: any): void {
    this.events.once(event, listener);
  }

  public off(event: string, listener: any): void {
    this.events.off(event, listener);
  }

  public removeListener(event: string, listener: any): void {
    this.events.removeListener(event, listener);
  }

  // ---------- Protected ----------------------------------------------- //

  protected async propose(params?: PairingTypes.ProposeParams): Promise<PairingTypes.Pending> {
    // TODO: abstract this inside engine
    const relay = params?.relay || { protocol: RELAYER_DEFAULT_PROTOCOL };
    const topic = (params as any).topic || generateRandomBytes32();
    const self = (params as any).self || {
      publicKey: await this.client.crypto.generateKeyPair(),
    };
    const proposer: PairingTypes.ProposedPeer = {
      publicKey: self.publicKey,
      controller: this.client.controller,
    };
    // TODO: pairing-specific (start)
    const uri = formatUri({
      protocol: this.client.protocol,
      version: this.client.version,
      topic: topic,
      publicKey: proposer.publicKey,
      controller: proposer.controller,
      relay: relay,
    });
    const signal: PairingTypes.Signal = {
      method: PAIRING_SIGNAL_METHOD_URI,
      params: { uri },
    };
    const permissions: PairingTypes.ProposedPermissions = {
      jsonrpc: {
        methods: [SESSION_JSONRPC.propose],
      },
    };
    const ttl = PAIRING_DEFAULT_TTL;
    // TODO: pairing-specific (end)
    return this.engine.propose({ ...params, signal, permissions, ttl } as any);
  }

  protected async settle(params: PairingTypes.SettleParams): Promise<PairingTypes.Settled> {
    return this.engine.settle(params);
  }
}
