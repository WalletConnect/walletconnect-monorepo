import EventEmitter from "events";
import { Engine } from "./controllers";
import { IWeb3Wallet, Web3WalletTypes } from "./types";

export class Web3Wallet extends IWeb3Wallet {
  public readonly name: IWeb3Wallet["name"] = "Web3Wallet";
  public core: IWeb3Wallet["core"];
  public logger: IWeb3Wallet["logger"];
  public events: IWeb3Wallet["events"] = new EventEmitter();
  public engine: IWeb3Wallet["engine"];

  static async init(opts: Web3WalletTypes.Options) {
    const client = new Web3Wallet(opts);
    await client.initialize();

    return client;
  }

  constructor(opts: Web3WalletTypes.Options) {
    super(opts);
    this.core = opts.core;
    this.logger = this.core.logger;
    this.engine = new Engine(this);
  }

  // ---------- Events ----------------------------------------------- //

  public on: IWeb3Wallet["on"] = (name, listener) => {
    return this.events.on(name, listener);
  };

  public once: IWeb3Wallet["once"] = (name, listener) => {
    return this.events.once(name, listener);
  };

  public off: IWeb3Wallet["off"] = (name, listener) => {
    return this.events.off(name, listener);
  };

  public removeListener: IWeb3Wallet["removeListener"] = (name, listener) => {
    return this.events.removeListener(name, listener);
  };

  // ---------- Engine ----------------------------------------------- //

  public approveSession: IWeb3Wallet["approveSession"] = async (params) => {
    try {
      return await this.engine.approveSession(params);
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public rejectSession: IWeb3Wallet["rejectSession"] = async (params) => {
    try {
      return await this.engine.rejectSession(params);
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public updateSession: IWeb3Wallet["updateSession"] = async (params) => {
    try {
      return await this.engine.updateSession(params);
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public extendSession: IWeb3Wallet["extendSession"] = async (params) => {
    try {
      return await this.engine.extendSession(params);
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public respondSessionRequest: IWeb3Wallet["respondSessionRequest"] = async (params) => {
    try {
      return await this.engine.respondSessionRequest(params);
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public disconnectSession: IWeb3Wallet["disconnectSession"] = async (params) => {
    try {
      return await this.engine.disconnectSession(params);
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public emitSessionEvent: IWeb3Wallet["emitSessionEvent"] = async (params) => {
    try {
      return await this.engine.emitSessionEvent(params);
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public getActiveSessions: IWeb3Wallet["getActiveSessions"] = async () => {
    try {
      return await this.engine.getActiveSessions();
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public getPendingSessionProposals: IWeb3Wallet["getPendingSessionProposals"] = async () => {
    try {
      return await this.engine.getPendingSessionProposals();
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public respondAuthRequest: IWeb3Wallet["respondAuthRequest"] = async (params, iss) => {
    try {
      return await this.engine.respondAuthRequest(params, iss);
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public getPendingAuthRequests: IWeb3Wallet["getPendingAuthRequests"] = async () => {
    try {
      return await this.engine.getPendingAuthRequests();
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public formatMessage: IWeb3Wallet["formatMessage"] = async (params, iss) => {
    try {
      return await this.engine.formatMessage(params, iss);
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };
  // ---------- Private ----------------------------------------------- //

  private async initialize() {
    this.logger.trace(`Initialized`);
    try {
      await this.engine.init();
      this.logger.info(`Web3Wallet Initilization Success`);
    } catch (error: any) {
      this.logger.info(`Web3Wallet Initilization Failure`);
      this.logger.error(error.message);
      throw error;
    }
  }
}
