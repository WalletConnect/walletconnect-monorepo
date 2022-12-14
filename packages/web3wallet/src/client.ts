import EventEmitter from "events";
import { Engine } from "./controllers";
import { IWeb3WalletClient, Web3WalletTypes } from "./types";

export class Web3Wallet extends IWeb3WalletClient {
  public readonly name: IWeb3WalletClient["name"] = "Web3Wallet";
  public core: IWeb3WalletClient["core"];
  public logger: IWeb3WalletClient["logger"];
  public events: IWeb3WalletClient["events"] = new EventEmitter();
  public engine: IWeb3WalletClient["engine"];

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

  public on: IWeb3WalletClient["on"] = (name, listener) => {
    return this.events.on(name, listener);
  };

  public once: IWeb3WalletClient["once"] = (name, listener) => {
    return this.events.once(name, listener);
  };

  public off: IWeb3WalletClient["off"] = (name, listener) => {
    return this.events.off(name, listener);
  };

  public removeListener: IWeb3WalletClient["removeListener"] = (name, listener) => {
    return this.events.removeListener(name, listener);
  };

  // ---------- Engine ----------------------------------------------- //

  public approveSession: IWeb3WalletClient["approveSession"] = async (params) => {
    try {
      return await this.engine.approveSession(params);
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public rejectSession: IWeb3WalletClient["rejectSession"] = async (params) => {
    try {
      return await this.engine.rejectSession(params);
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public updateSession: IWeb3WalletClient["updateSession"] = async (params) => {
    try {
      return await this.engine.updateSession(params);
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public extendSession: IWeb3WalletClient["extendSession"] = async (params) => {
    try {
      return await this.engine.extendSession(params);
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public respondSessionRequest: IWeb3WalletClient["respondSessionRequest"] = async (params) => {
    try {
      return await this.engine.respondSessionRequest(params);
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public disconnectSession: IWeb3WalletClient["disconnectSession"] = async (params) => {
    try {
      return await this.engine.disconnectSession(params);
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public emitSessionEvent: IWeb3WalletClient["emitSessionEvent"] = async (params) => {
    try {
      return await this.engine.emitSessionEvent(params);
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public getActiveSessions: IWeb3WalletClient["getActiveSessions"] = async () => {
    try {
      return await this.engine.getActiveSessions();
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public getPendingSessionProposals: IWeb3WalletClient["getPendingSessionProposals"] = async () => {
    try {
      return await this.engine.getPendingSessionProposals();
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public respondAuthRequest: IWeb3WalletClient["respondAuthRequest"] = async (params, iss) => {
    try {
      return await this.engine.respondAuthRequest(params, iss);
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public getPendingAuthRequests: IWeb3WalletClient["getPendingAuthRequests"] = async () => {
    try {
      return await this.engine.getPendingAuthRequests();
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public formatMessage: IWeb3WalletClient["formatMessage"] = async (params, iss) => {
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
