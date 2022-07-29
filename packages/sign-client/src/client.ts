import { Core } from "@walletconnect/core";
import {
  generateChildLogger,
  getDefaultLoggerOptions,
  getLoggerContext,
} from "@walletconnect/logger";
import { SignClientTypes, ISignClient, ISignClientEvents, EngineTypes } from "@walletconnect/types";
import { getAppMetadata } from "@walletconnect/utils";
import { EventEmitter } from "events";
import pino from "pino";
import { SIGN_CLIENT_DEFAULT, SIGN_CLIENT_PROTOCOL, SIGN_CLIENT_VERSION } from "./constants";
import { Engine, Expirer, JsonRpcHistory, Pairing, Proposal, Session } from "./controllers";

export class SignClient extends ISignClient {
  public readonly protocol = SIGN_CLIENT_PROTOCOL;
  public readonly version = SIGN_CLIENT_VERSION;
  public readonly name: ISignClient["name"] = SIGN_CLIENT_DEFAULT.name;
  public readonly metadata: ISignClient["metadata"];

  public core: ISignClient["core"];
  public logger: ISignClient["logger"];
  public events: ISignClient["events"] = new EventEmitter();
  public engine: ISignClient["engine"];
  public pairing: ISignClient["pairing"];
  public session: ISignClient["session"];
  public proposal: ISignClient["proposal"];
  public history: ISignClient["history"];
  public expirer: ISignClient["expirer"];

  static async init(opts?: SignClientTypes.Options) {
    const client = new SignClient(opts);
    await client.initialize();

    return client;
  }

  constructor(opts?: SignClientTypes.Options) {
    super(opts);

    this.name = opts?.name || SIGN_CLIENT_DEFAULT.name;
    this.metadata = opts?.metadata || getAppMetadata();

    const logger =
      typeof opts?.logger !== "undefined" && typeof opts?.logger !== "string"
        ? opts.logger
        : pino(getDefaultLoggerOptions({ level: opts?.logger || SIGN_CLIENT_DEFAULT.logger }));

    this.core = opts?.core || new Core(opts);
    this.logger = generateChildLogger(logger, this.name);
    this.pairing = new Pairing(this.core, this.logger);
    this.session = new Session(this.core, this.logger);
    this.proposal = new Proposal(this.core, this.logger);
    this.history = new JsonRpcHistory(this.core, this.logger);
    this.expirer = new Expirer(this.core, this.logger);
    this.engine = new Engine(this);
  }

  get context() {
    return getLoggerContext(this.logger);
  }

  // ---------- Events ----------------------------------------------- //

  public on: ISignClientEvents["on"] = (name, listener) => {
    return this.events.on(name, listener);
  };

  public once: ISignClientEvents["once"] = (name, listener) => {
    return this.events.once(name, listener);
  };

  public off: ISignClientEvents["off"] = (name, listener) => {
    return this.events.off(name, listener);
  };

  public removeListener: ISignClientEvents["removeListener"] = (name, listener) => {
    return this.events.removeListener(name, listener);
  };

  // ---------- Engine ----------------------------------------------- //

  public connect: ISignClient["connect"] = async (params) => {
    try {
      return await this.engine.connect(params);
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public pair: ISignClient["pair"] = async (params) => {
    try {
      return await this.engine.pair(params);
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public approve: ISignClient["approve"] = async (params) => {
    try {
      return await this.engine.approve(params);
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public reject: ISignClient["reject"] = async (params) => {
    try {
      return await this.engine.reject(params);
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public update: ISignClient["update"] = async (params) => {
    try {
      return await this.engine.update(params);
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public extend: ISignClient["extend"] = async (params) => {
    try {
      return await this.engine.extend(params);
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public request: ISignClient["request"] = async <T>(params: EngineTypes.RequestParams) => {
    try {
      return await this.engine.request<T>(params);
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public respond: ISignClient["respond"] = async (params) => {
    try {
      return await this.engine.respond(params);
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public ping: ISignClient["ping"] = async (params) => {
    try {
      return await this.engine.ping(params);
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public emit: ISignClient["emit"] = async (params) => {
    try {
      return await this.engine.emit(params);
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public disconnect: ISignClient["disconnect"] = async (params) => {
    try {
      return await this.engine.disconnect(params);
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public find: ISignClient["find"] = (params) => {
    try {
      return this.engine.find(params);
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  // ---------- Private ----------------------------------------------- //

  private async initialize() {
    this.logger.trace(`Initialized`);
    try {
      await this.core.start();
      await this.pairing.init();
      await this.session.init();
      await this.proposal.init();
      await this.history.init();
      await this.expirer.init();
      await this.engine.init();
      this.logger.info(`SignClient Initilization Success`);
    } catch (error: any) {
      this.logger.info(`SignClient Initilization Failure`);
      this.logger.error(error.message);
      throw error;
    }
  }
}
