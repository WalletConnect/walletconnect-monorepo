import { HeartBeat } from "@walletconnect/heartbeat";
import {
  generateChildLogger,
  getDefaultLoggerOptions,
  getLoggerContext,
} from "@walletconnect/logger";
import {
  AppMetadata,
  ClientOptions,
  ClientTypes,
  IClient,
  NewTypes,
  SessionTypes,
} from "@walletconnect/types";
import {
  ERROR,
  formatRelayRpcUrl,
  getAppMetadata,
  isSessionFailed,
  isSessionResponded,
} from "@walletconnect/utils";
import { EventEmitter } from "events";
import pino, { Logger } from "pino";
import { CLIENT_DEFAULT, SESSION_EMPTY_RESPONSE, SESSION_EMPTY_STATE } from "./constants";
import { Crypto, Pairing, Relayer, Session } from "./controllers";
import NewEngine from "./controllers/new_engine";

export class Client extends IClient {
  public readonly protocol = "wc";
  public readonly version = 2;
  public readonly name: string = CLIENT_DEFAULT.name;
  public readonly controller: boolean;
  public readonly metadata: AppMetadata | undefined;
  public readonly relayUrl: string | undefined;
  public readonly projectId: string | undefined;

  public logger: Logger;
  public pairing: Pairing;
  public session: Session;
  protected heartbeat: HeartBeat;
  protected events = new EventEmitter();
  protected relayer: Relayer;
  protected crypto: Crypto;
  protected engine: NewEngine;

  static async init(opts?: ClientOptions): Promise<Client> {
    const client = new Client(opts);
    await client.initialize();
    return client;
  }

  constructor(opts?: ClientOptions) {
    super(opts);
    const logger =
      typeof opts?.logger !== "undefined" && typeof opts?.logger !== "string"
        ? opts.logger
        : pino(getDefaultLoggerOptions({ level: opts?.logger || CLIENT_DEFAULT.logger }));

    this.name = opts?.name || CLIENT_DEFAULT.name;
    this.controller = opts?.controller || CLIENT_DEFAULT.controller;
    this.metadata = opts?.metadata || getAppMetadata();
    this.projectId = opts?.projectId;
    this.logger = generateChildLogger(logger, this.name);
    this.heartbeat = new HeartBeat();
    this.crypto = new Crypto(this, this.logger, opts?.keychain);

    this.relayUrl = formatRelayRpcUrl(
      this.protocol,
      this.version,
      opts?.relayUrl || CLIENT_DEFAULT.relayUrl,
      this.projectId,
    );

    this.relayer = new Relayer({
      rpcUrl: this.relayUrl,
      heartbeat: this.heartbeat,
      logger: this.logger,
      projectId: this.projectId,
    });

    this.pairing = new Pairing(this, this.logger);
    this.session = new Session(this, this.logger);
    this.engine = new NewEngine(this.relayer, this.crypto, this.session, this.pairing);
  }

  get context(): string {
    return getLoggerContext(this.logger);
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

  public async connect(params: NewTypes.CreateSessionParams) {
    try {
      await this.engine.createSession(params);
    } catch (err) {
      this.logger.error(err);
      throw err;
    }
  }

  public async pair(params: ClientTypes.PairParams) {
    try {
      await this.engine.pair();
    } catch (err) {
      this.logger.error(err);
      throw err;
    }
  }

  public async approve(params: ClientTypes.ApproveParams): Promise<SessionTypes.Settled> {
    this.logger.debug(`Approving Session Proposal`);
    this.logger.trace({ type: "method", method: "approve", params });
    if (typeof params.response === "undefined") {
      const error = ERROR.MISSING_RESPONSE.format({ context: "session" });
      this.logger.error(error.message);
      throw new Error(error.message);
    }
    const state = params.response.state || SESSION_EMPTY_STATE;
    const metadata = params.response.metadata || this.metadata;
    if (typeof metadata === "undefined") {
      const error = ERROR.MISSING_OR_INVALID.format({ name: "app metadata" });
      this.logger.error(error.message);
      throw new Error(error.message);
    }
    const approved = params.proposal.proposer.controller !== this.controller;
    const reason = approved
      ? undefined
      : ERROR.UNAUTHORIZED_MATCHING_CONTROLLER.format({ controller: this.controller });
    const pending = await this.session.respond({
      approved,
      proposal: params.proposal,
      response: { state, metadata },
      reason,
    });
    if (!isSessionResponded(pending)) {
      const error = ERROR.NO_MATCHING_RESPONSE.format({ context: "session" });
      this.logger.error(error.message);
      throw new Error(error.message);
    }
    if (isSessionFailed(pending.outcome)) {
      this.logger.debug(`Session Proposal Approval Failure`);
      this.logger.trace({ type: "method", method: "approve", outcome: pending.outcome });
      throw new Error(pending.outcome.reason.message);
    }
    this.logger.debug(`Session Proposal Approval Success`);
    this.logger.trace({ type: "method", method: "approve", pending });
    return this.session.get(pending.outcome.topic);
  }

  public async reject(params: ClientTypes.RejectParams): Promise<void> {
    this.logger.debug(`Rejecting Session Proposal`);
    this.logger.trace({ type: "method", method: "reject", params });
    const pending = await this.session.respond({
      approved: false,
      proposal: params.proposal,
      response: SESSION_EMPTY_RESPONSE,
      reason: params.reason,
    });
    this.logger.debug(`Session Proposal Response Success`);
    this.logger.trace({ type: "method", method: "reject", pending });
  }

  public async update(params: ClientTypes.UpdateParams): Promise<void> {
    await this.session.update(params);
  }

  public async upgrade(params: ClientTypes.UpgradeParams): Promise<void> {
    await this.session.upgrade(params);
  }

  public async extend(params: ClientTypes.ExtendParams): Promise<void> {
    await this.session.extend(params);
  }

  public async request(params: ClientTypes.RequestParams): Promise<any> {
    return this.session.request(params);
  }

  public async respond(params: ClientTypes.RespondParams): Promise<void> {
    await this.session.send(params.topic, params.response);
  }

  public async ping(params: ClientTypes.PingParams): Promise<void> {
    await this.session.ping(params.topic, params.timeout);
  }

  public async notify(params: ClientTypes.NotifyParams): Promise<void> {
    await this.session.notify(params);
  }

  public async disconnect(params: ClientTypes.DisconnectParams): Promise<void> {
    this.logger.debug(`Disconnecting Application`);
    this.logger.trace({ type: "method", method: "disconnect", params });
    await this.session.delete(params);
  }

  // ---------- Private ----------------------------------------------- //

  private async initialize(): Promise<any> {
    this.logger.trace(`Initialized`);
    try {
      await this.pairing.init();
      await this.session.init();
      await this.crypto.init();
      await this.relayer.init();
      await this.heartbeat.init();
      this.logger.info(`Client Initilization Success`);
    } catch (e) {
      this.logger.info(`Client Initilization Failure`);
      this.logger.error(e as any);
      throw e;
    }
  }
}
