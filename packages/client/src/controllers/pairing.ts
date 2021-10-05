import { EventEmitter } from "events";
import { Logger } from "pino";
import { generateChildLogger, getLoggerContext } from "@walletconnect/logger";
import { PairingTypes, IClient, IPairing } from "@walletconnect/types";
import { JsonRpcPayload } from "@walletconnect/jsonrpc-utils";
import { formatUri, mergeArrays } from "@walletconnect/utils";

import { State } from "./state";
import { Engine } from "./engine";
import { JsonRpcHistory } from "./history";
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
  public pending: State<PairingTypes.Pending>;
  public settled: State<PairingTypes.Settled>;
  public history: JsonRpcHistory;

  public events = new EventEmitter();

  public name: string = PAIRING_CONTEXT;

  public config = {
    status: PAIRING_STATUS,
    events: PAIRING_EVENTS,
    jsonrpc: PAIRING_JSONRPC,
  };

  public engine: PairingTypes.Engine;

  constructor(public client: IClient, public logger: Logger) {
    super(client, logger);
    this.logger = generateChildLogger(logger, this.name);
    this.pending = new State<PairingTypes.Pending>(client, this.logger, this.config.status.pending);
    this.settled = new State<PairingTypes.Settled>(client, this.logger, this.config.status.settled);
    this.history = new JsonRpcHistory(client, this.logger);
    this.engine = new Engine(this) as PairingTypes.Engine;
  }

  public async init(): Promise<void> {
    this.logger.trace(`Initialized`);
    await this.pending.init();
    await this.settled.init();
    await this.history.init();
  }

  public get(topic: string): Promise<PairingTypes.Settled> {
    return this.settled.get(topic);
  }

  public find(permissions: Partial<PairingTypes.Permissions>): Promise<PairingTypes.Settled[]> {
    return this.engine.find(permissions);
  }

  public ping(topic: string, timeout?: number): Promise<void> {
    return this.engine.ping(topic, timeout);
  }

  public send(topic: string, payload: JsonRpcPayload): Promise<void> {
    return this.engine.send(topic, payload);
  }

  get context(): string {
    return getLoggerContext(this.logger);
  }

  get length(): number {
    return this.settled.length;
  }

  get topics(): string[] {
    return this.settled.topics;
  }

  get values(): PairingTypes.Settled[] {
    return this.settled.values;
  }

  public create(params?: PairingTypes.CreateParams): Promise<PairingTypes.Settled> {
    return this.engine.create(params);
  }

  public respond(params: PairingTypes.RespondParams): Promise<PairingTypes.Pending> {
    return this.engine.respond(params);
  }

  public upgrade(params: PairingTypes.UpgradeParams): Promise<PairingTypes.Settled> {
    return this.engine.upgrade(params);
  }

  public update(params: PairingTypes.UpdateParams): Promise<PairingTypes.Settled> {
    return this.engine.update(params);
  }

  public request(params: PairingTypes.RequestParams): Promise<any> {
    return this.engine.request(params);
  }

  public delete(params: PairingTypes.DeleteParams): Promise<void> {
    return this.engine.delete(params);
  }

  public notify(params: PairingTypes.NotificationEvent): Promise<void> {
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

  public async mergeUpdate(topic: string, update: PairingTypes.Update) {
    const settled = await this.settled.get(topic);
    const state = {
      metadata: update.state.metadata || settled.state.metadata,
    };
    return state;
  }

  public async mergeUpgrade(topic: string, upgrade: PairingTypes.Upgrade) {
    const settled = await this.settled.get(topic);
    const permissions = {
      jsonrpc: {
        methods: mergeArrays(
          settled.permissions.jsonrpc.methods,
          upgrade.permissions.jsonrpc?.methods || [],
        ),
      },
      notifications: {
        types: mergeArrays(
          settled.permissions.notifications?.types || [],
          upgrade.permissions.notifications?.types || [],
        ),
      },
      controller: settled.permissions.controller,
    };
    return permissions;
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
