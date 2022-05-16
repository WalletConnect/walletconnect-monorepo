import { Core } from "@walletconnect/core";
import {
  generateChildLogger,
  getDefaultLoggerOptions,
  getLoggerContext,
} from "@walletconnect/logger";
import { ClientTypes, IClient, IClientEvents } from "@walletconnect/types";
import { getAppMetadata } from "@walletconnect/utils";
import { EventEmitter } from "events";
import pino from "pino";
import { CLIENT_DEFAULT, CLIENT_PROTOCOL, CLIENT_VERSION } from "./constants";
import { Engine, Expirer, JsonRpcHistory, Pairing, Proposal, Session } from "./controllers";

export class Client extends IClient {
  public readonly protocol = CLIENT_PROTOCOL;
  public readonly version = CLIENT_VERSION;
  public readonly name: IClient["name"] = CLIENT_DEFAULT.name;
  public readonly metadata: IClient["metadata"];

  public core: IClient["core"];
  public logger: IClient["logger"];
  public events: IClient["events"] = new EventEmitter();

  public engine: IClient["engine"];
  public pairing: IClient["pairing"];
  public session: IClient["session"];
  public proposal: IClient["proposal"];
  public history: IClient["history"];
  public expirer: IClient["expirer"];

  static async init(opts?: ClientTypes.Options) {
    const client = new Client(opts);
    await client.initialize();

    return client;
  }

  constructor(opts?: ClientTypes.Options) {
    super(opts);

    this.name = opts?.name || CLIENT_DEFAULT.name;
    this.metadata = opts?.metadata || getAppMetadata();

    const logger =
      typeof opts?.logger !== "undefined" && typeof opts?.logger !== "string"
        ? opts.logger
        : pino(getDefaultLoggerOptions({ level: opts?.logger || CLIENT_DEFAULT.logger }));

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

  public on: IClientEvents["on"] = (name, listener) => {
    return this.events.on(name, listener);
  };

  public once: IClientEvents["once"] = (name, listener) => {
    return this.events.once(name, listener);
  };

  public off: IClientEvents["off"] = (name, listener) => {
    return this.events.off(name, listener);
  };

  public removeListener: IClientEvents["removeListener"] = (name, listener) => {
    return this.events.removeListener(name, listener);
  };

  // ---------- Engine ----------------------------------------------- //

  public connect: IClient["connect"] = async params => {
    try {
      return await this.engine.connect(params);
    } catch (error) {
      this.logger.error((error as any).message);
      throw error;
    }
  };

  public pair: IClient["pair"] = async params => {
    try {
      return await this.engine.pair(params);
    } catch (error) {
      this.logger.error((error as any).message);
      throw error;
    }
  };

  public approve: IClient["approve"] = async params => {
    try {
      return await this.engine.approve(params);
    } catch (error) {
      this.logger.error((error as any).message);
      throw error;
    }
  };

  public reject: IClient["reject"] = async params => {
    try {
      return await this.engine.reject(params);
    } catch (error) {
      this.logger.error((error as any).message);
      throw error;
    }
  };

  public update: IClient["update"] = async params => {
    try {
      return await this.engine.update(params);
    } catch (error) {
      this.logger.error((error as any).message);
      throw error;
    }
  };

  public extend: IClient["extend"] = async params => {
    try {
      return await this.engine.extend(params);
    } catch (error) {
      this.logger.error((error as any).message);
      throw error;
    }
  };

  public request: IClient["request"] = async params => {
    try {
      return await this.engine.request(params);
    } catch (error) {
      this.logger.error((error as any).message);
      throw error;
    }
  };

  public respond: IClient["respond"] = async params => {
    try {
      return await this.engine.respond(params);
    } catch (error) {
      this.logger.error((error as any).message);
      throw error;
    }
  };

  public ping: IClient["ping"] = async params => {
    try {
      return await this.engine.ping(params);
    } catch (error) {
      this.logger.error((error as any).message);
      throw error;
    }
  };

  public emit: IClient["emit"] = async params => {
    try {
      return await this.engine.emit(params);
    } catch (error) {
      this.logger.error((error as any).message);
      throw error;
    }
  };

  public disconnect: IClient["disconnect"] = async params => {
    try {
      return await this.engine.disconnect(params);
    } catch (error) {
      this.logger.error((error as any).message);
      throw error;
    }
  };

  public find: IClient["find"] = params => {
    try {
      return this.engine.find(params);
    } catch (error) {
      this.logger.error((error as any).message);
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

      this.logger.info(`Client Initilization Success`);
    } catch (error) {
      this.logger.info(`Client Initilization Failure`);
      this.logger.error((error as any).message);
      throw error;
    }
  }
}
