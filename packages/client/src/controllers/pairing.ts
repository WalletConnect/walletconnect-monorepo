import { EventEmitter } from "events";
import { Logger } from "pino";
import { generateChildLogger } from "@pedrouid/pino-utils";
import { PairingTypes, IClient, IPairing } from "@walletconnect/types";
import { formatUri } from "@walletconnect/utils";
import { JsonRpcPayload } from "@json-rpc-tools/utils";

import { Subscription } from "./subscription";
import { JsonRpcHistory } from "./history";
import { Engine } from "./engine";
import {
  PAIRING_CONTEXT,
  PAIRING_EVENTS,
  PAIRING_JSONRPC,
  PAIRING_STATUS,
  PAIRING_SIGNAL_METHOD_URI,
  SESSION_JSONRPC,
  PAIRING_DEFAULT_TTL,
} from "../constants";

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

  public engine: Engine;

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

  public async notify(params: PairingTypes.NotificationEvent): Promise<void> {
    return this.engine.notify(params);
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

  public async validateRespond(params?: PairingTypes.RespondParams) {
    // nothing to validate
  }

  public async validateRequest(params?: PairingTypes.RequestParams) {
    // nothing to validate
  }

  public async validatePropose(params?: PairingTypes.ProposeParams) {
    // nothing to validate
  }

  public async getDefaultSignal({ topic, relay, proposer }: PairingTypes.DefaultSignalParams) {
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
    return signal;
  }

  public async getDefaultTTL() {
    return PAIRING_DEFAULT_TTL;
  }

  public async getDefaultPermissions() {
    const permissions: PairingTypes.ProposedPermissions = {
      jsonrpc: {
        methods: [SESSION_JSONRPC.propose],
      },
      notifications: {
        types: [],
      },
    };
    return permissions;
  }
}
