import { EventEmitter } from "events";
import { Logger } from "pino";
import { generateChildLogger } from "@walletconnect/logger";
import { IClient, ISession, SessionTypes } from "@walletconnect/types";
import {
  validateSessionProposeParams,
  validateSessionRespondParams,
  isValidationInvalid,
  ERROR,
} from "@walletconnect/utils";
import { JsonRpcPayload } from "@walletconnect/jsonrpc-utils";

import { Subscription } from "./subscription";
import { JsonRpcHistory } from "./history";
import {
  SESSION_CONTEXT,
  SESSION_EVENTS,
  SESSION_JSONRPC,
  SESSION_STATUS,
  SESSION_SIGNAL_METHOD_PAIRING,
  SESSION_DEFAULT_TTL,
} from "../constants";
import { Engine } from "./engine";

export class Session extends ISession {
  public pending: Subscription<SessionTypes.Pending>;
  public settled: Subscription<SessionTypes.Settled>;
  public history: JsonRpcHistory;

  public events = new EventEmitter();

  public context: string = SESSION_CONTEXT;

  public config = {
    status: SESSION_STATUS,
    events: SESSION_EVENTS,
    jsonrpc: SESSION_JSONRPC,
  };

  public engine: SessionTypes.Engine;

  constructor(public client: IClient, public logger: Logger) {
    super(client, logger);
    this.logger = generateChildLogger(logger, this.context);
    this.pending = new Subscription<SessionTypes.Pending>(
      client,
      this.logger,
      this.config.status.pending,
    );
    this.settled = new Subscription<SessionTypes.Settled>(
      client,
      this.logger,
      this.config.status.settled,
    );
    this.history = new JsonRpcHistory(client, this.logger);
    this.engine = new Engine(this) as SessionTypes.Engine;
  }

  public async init(): Promise<void> {
    this.logger.trace(`Initialized`);
    await this.pending.init();
    await this.settled.init();
    await this.history.init();
  }

  public get(topic: string): Promise<SessionTypes.Settled> {
    return this.settled.get(topic);
  }

  public find(permissions: Partial<SessionTypes.Permissions>): Promise<SessionTypes.Settled[]> {
    return this.engine.find(permissions);
  }

  public ping(topic: string, timeout?: number): Promise<void> {
    return this.engine.ping(topic, timeout);
  }

  public send(topic: string, payload: JsonRpcPayload, chainId?: string): Promise<void> {
    return this.engine.send(topic, payload, chainId);
  }

  get length(): number {
    return this.settled.length;
  }

  get topics(): string[] {
    return this.settled.topics;
  }

  get values(): SessionTypes.Settled[] {
    return this.settled.values.map(x => x.data);
  }

  public create(params?: SessionTypes.CreateParams): Promise<SessionTypes.Settled> {
    return this.engine.create(params) as any;
  }

  public respond(params: SessionTypes.RespondParams): Promise<SessionTypes.Pending> {
    return this.engine.respond(params as any) as any;
  }

  public upgrade(params: SessionTypes.UpgradeParams): Promise<SessionTypes.Settled> {
    // TODO: fix type casting as any
    return this.engine.upgrade(params as any) as any;
  }

  public update(params: SessionTypes.UpdateParams): Promise<SessionTypes.Settled> {
    // TODO: fix type casting as any
    return this.engine.update(params as any) as any;
  }

  public request(params: SessionTypes.RequestParams): Promise<any> {
    return this.engine.request(params);
  }

  public delete(params: SessionTypes.DeleteParams): Promise<void> {
    return this.engine.delete(params);
  }

  public notify(params: SessionTypes.NotificationEvent): Promise<void> {
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

  public async mergeUpdate(topic: string, update: SessionTypes.Update) {
    const settled = await this.settled.get(topic);
    const state = {
      accounts: update.state?.accounts || settled.state.accounts,
    };
    return state;
  }
  public async mergeUpgrade(topic: string, upgrade: SessionTypes.Upgrade) {
    const settled = await this.settled.get(topic);
    const permissions = {
      jsonrpc: {
        methods: [
          ...settled.permissions.jsonrpc.methods,
          ...(upgrade.permissions.jsonrpc?.methods || []),
        ],
      },
      notifications: {
        types: [
          ...settled.permissions.notifications?.types,
          ...(upgrade.permissions.notifications?.types || []),
        ],
      },
      blockchain: {
        chains: [
          ...settled.permissions.blockchain?.chains,
          ...(upgrade.permissions.blockchain?.chains || []),
        ],
      },
      controller: settled.permissions.controller,
    };
    return permissions;
  }
  public async validateRespond(params?: SessionTypes.RespondParams) {
    if (typeof params === "undefined") {
      const error = ERROR.MISSING_OR_INVALID.format({ name: "respond params" });
      this.logger.error(error.message);
      throw new Error(error.message);
    }
    const paramsValidation = validateSessionRespondParams(params);
    if (isValidationInvalid(paramsValidation)) {
      this.logger.error(paramsValidation.error.message);
      throw new Error(paramsValidation.error.message);
    }
  }

  public async validateRequest(params?: SessionTypes.RequestParams) {
    if (typeof params === "undefined") {
      const error = ERROR.MISSING_OR_INVALID.format({ name: "request params" });
      this.logger.error(error.message);
      throw new Error(error.message);
    }
    const { topic, chainId } = params;
    const settled = await this.settled.get(topic);
    if (chainId && !settled.permissions.blockchain.chains.includes(chainId)) {
      const error = ERROR.UNAUTHORIZED_TARGET_CHAIN.format({ chainId });
      this.logger.error(error.message);
      throw new Error(error.message);
    }
  }

  public async validatePropose(params?: SessionTypes.ProposeParams) {
    if (typeof params === "undefined") {
      const error = ERROR.MISSING_OR_INVALID.format({ name: "propose params" });
      this.logger.error(error.message);
      throw new Error(error.message);
    }
    const paramsValidation = validateSessionProposeParams(params);
    if (isValidationInvalid(paramsValidation)) {
      this.logger.error(paramsValidation.error.message);
      throw new Error(paramsValidation.error.message);
    }
    if (params.signal.method !== SESSION_SIGNAL_METHOD_PAIRING) {
      const error = ERROR.UNSUPPORTED_SIGNAL.format({ context: this.context });
      this.logger.error(error.message);
      throw new Error(error.message);
    }
  }

  public async getDefaultSignal(params: SessionTypes.DefaultSignalParams) {
    const pairing = await this.client.pairing.settled.get(params.topic);
    const signal: SessionTypes.Signal = {
      method: SESSION_SIGNAL_METHOD_PAIRING,
      params: { topic: pairing.topic },
    };
    return signal;
  }

  public async getDefaultTTL() {
    return SESSION_DEFAULT_TTL;
  }

  public async getDefaultPermissions() {
    return {
      jsonrpc: {
        methods: [],
      },
      notifications: {
        types: [],
      },
      blockchain: {
        chains: [],
      },
    };
  }
}
