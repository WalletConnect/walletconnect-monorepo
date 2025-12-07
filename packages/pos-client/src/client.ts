import EventEmitter from "events";
import { CLIENT_CONTEXT } from "./constants/index.js";
import { Engine } from "./controllers/index.js";
import { IPOSClient, POSClientTypes } from "./types/index.js";

export class POSClient extends IPOSClient {
  public name: IPOSClient["name"];
  public events: IPOSClient["events"] = new EventEmitter();
  public engine: IPOSClient["engine"];
  public metadata: IPOSClient["metadata"];

  static async init(opts: POSClientTypes.Options) {
    const client = new POSClient(opts);
    await client.initialize();

    return client;
  }

  constructor(opts: POSClientTypes.Options) {
    super(opts);
    this.metadata = opts.metadata;
    this.name = CLIENT_CONTEXT;
    this.engine = new Engine(this);
  }

  get sessions(): IPOSClient["sessions"] {
    return this.engine.signClient.session.getAll();
  }

  get session(): IPOSClient["session"] {
    return this.sessions[0];
  }

  // ---------- Events ----------------------------------------------- //

  public on: IPOSClient["on"] = (name, listener) => {
    return this.engine.on(name, listener);
  };

  public once: IPOSClient["once"] = (name, listener) => {
    return this.engine.once(name, listener);
  };

  public off: IPOSClient["off"] = (name, listener) => {
    return this.engine.off(name, listener);
  };

  public removeListener: IPOSClient["removeListener"] = (name, listener) => {
    return this.engine.removeListener(name, listener);
  };

  // ---------- Engine ----------------------------------------------- //

  public setTokens: IPOSClient["setTokens"] = async (params) => {
    try {
      return await this.engine.setTokens(params);
    } catch (error: any) {
      this.engine.logger.error(error.message);
      throw error;
    }
  };

  public createPaymentIntent: IPOSClient["createPaymentIntent"] = async (params) => {
    try {
      return await this.engine.createPaymentIntent(params);
    } catch (error: any) {
      this.engine.logger.error(error.message);
      throw error;
    }
  };

  public restart: IPOSClient["restart"] = async (params) => {
    try {
      return await this.engine.restart(params);
    } catch (error: any) {
      this.engine.logger.error(error.message);
      throw error;
    }
  };

  public sendPaymentsToWallet: IPOSClient["sendPaymentsToWallet"] = async (params) => {
    try {
      return await this.engine.sendPaymentsToWallet(params);
    } catch (error: any) {
      this.engine.logger.error(error.message);
      throw error;
    }
  };

  public disconnect: IPOSClient["disconnect"] = async (params) => {
    try {
      return await this.engine.disconnect(params);
    } catch (error: any) {
      this.engine.logger.error(error.message);
      throw error;
    }
  };

  public connect: IPOSClient["connect"] = async (params) => {
    try {
      return await this.engine.connect(params);
    } catch (error: any) {
      this.engine.logger.error(error.message);
      throw error;
    }
  };
  // ---------- Private ----------------------------------------------- //

  private async initialize() {
    try {
      await this.engine.init();
      this.engine.logger.info(`POSClient Initialization Success`);
    } catch (error: any) {
      this.engine.logger.info(`POSClient Initialization Failure`);
      this.engine.logger.error(error.message);
      throw error;
    }
  }
}
