import { EventEmitter } from "events";
import { Core } from "@walletconnect/core";
import { SignClientTypes, ISignClient, ISignClientEvents, EngineTypes } from "@walletconnect/types";
import { populateAppMetadata, createLogger } from "@walletconnect/utils";
import { getLoggerContext } from "@walletconnect/logger";
import {
  SIGN_CLIENT_DEFAULT,
  SIGN_CLIENT_PROTOCOL,
  SIGN_CLIENT_VERSION,
} from "./constants/index.js";
import { AuthStore, Engine, PendingRequest, Proposal, Session } from "./controllers/index.js";

export class SignClient extends ISignClient {
  public readonly protocol = SIGN_CLIENT_PROTOCOL;
  public readonly version = SIGN_CLIENT_VERSION;
  public readonly name: ISignClient["name"] = SIGN_CLIENT_DEFAULT.name;
  public readonly metadata: ISignClient["metadata"];

  public core: ISignClient["core"];
  public logger: ISignClient["logger"];
  public events: ISignClient["events"] = new EventEmitter();
  public engine: ISignClient["engine"];
  public session: ISignClient["session"];
  public proposal: ISignClient["proposal"];
  public pendingRequest: ISignClient["pendingRequest"];
  public auth: ISignClient["auth"];
  public signConfig?: ISignClient["signConfig"];

  private readonly lifetime = new AbortController();
  public readonly signal = this.lifetime.signal;
  private readonly pending = new Set<Promise<unknown>>();
  private readonly mutations = new Set<Promise<unknown>>();
  private disposal: Promise<void> | undefined;
  private readonly onCoreDisposed = () => {
    this.dispose().catch((error) => this.logger.warn(error));
  };

  static async init(opts?: SignClientTypes.Options) {
    const client = new SignClient(opts);
    try {
      await client.initialize();
      return client;
    } catch (error) {
      try {
        await client.dispose();
      } catch (cleanupError) {
        throw Object.assign(new Error("SignClient initialization cleanup failed"), {
          cause: error,
          cleanupError,
        });
      }
      throw error;
    }
  }

  constructor(opts?: SignClientTypes.Options) {
    super(opts);

    this.name = opts?.name || SIGN_CLIENT_DEFAULT.name;
    this.metadata = populateAppMetadata(opts?.metadata);
    this.signConfig = opts?.signConfig;

    const logger = createLogger({
      logger: opts?.logger || SIGN_CLIENT_DEFAULT.logger,
      name: this.name,
    });
    this.logger = logger;
    this.core = opts?.core || new Core(opts);
    this.session = new Session(this.core, this.logger);
    this.proposal = new Proposal(this.core, this.logger);
    this.pendingRequest = new PendingRequest(this.core, this.logger);
    this.engine = new Engine(this);
    this.auth = new AuthStore(this.core, this.logger);
    this.core.assertActive();
    this.core.signal.addEventListener("abort", this.onCoreDisposed, { once: true });
  }

  public assertActive() {
    this.core.assertActive();
    if (this.signal.aborted) throw new Error("WalletConnect SignClient is disposed");
  }

  public run<T>(operation: () => Promise<T>): Promise<T> {
    return this.execute(operation, false);
  }

  public runMutation<T>(operation: () => Promise<T>): Promise<T> {
    return this.execute(operation, true);
  }

  private execute<T>(operation: () => Promise<T>, drain: boolean): Promise<T> {
    this.assertActive();
    const source = Promise.resolve().then(() => {
      this.assertActive();
      return operation();
    });
    if (drain) {
      this.mutations.add(source);
      source.finally(() => this.mutations.delete(source)).catch(() => undefined);
    }
    const task = new Promise<T>((resolve, reject) => {
      const abort = () => reject(new Error("WalletConnect SignClient is disposed"));
      this.signal.addEventListener("abort", abort, { once: true });
      source
        .then((result) => {
          try {
            this.assertActive();
            resolve(result);
          } catch (error) {
            reject(error);
          }
        }, reject)
        .finally(() => this.signal.removeEventListener("abort", abort));
      if (this.signal.aborted) abort();
    });
    this.pending.add(task);
    task.finally(() => this.pending.delete(task)).catch(() => undefined);
    return task;
  }

  public dispose(): Promise<void> {
    if (this.disposal) return this.disposal;
    let finish!: () => void;
    let fail!: (error: unknown) => void;
    this.disposal = new Promise<void>((resolve, reject) => {
      finish = resolve;
      fail = reject;
    });
    this.lifetime.abort();
    this.core.signal.removeEventListener("abort", this.onCoreDisposed);
    const work = [
      () => this.engine.dispose(),
      () => this.session.dispose(),
      () => this.proposal.dispose(),
      () => this.pendingRequest.dispose(),
      () => this.auth.authKeys.dispose(),
      () => this.auth.pairingTopics.dispose(),
      () => this.auth.requests.dispose(),
    ].map((dispose) => Promise.resolve().then(dispose));
    Promise.allSettled([...work, ...this.pending, ...this.mutations]).then((results) => {
      (this.events as EventEmitter).removeAllListeners();
      const failed = results.slice(0, work.length).find((result) => result.status === "rejected");
      if (failed?.status === "rejected") fail(failed.reason);
      else finish();
    });
    return this.disposal;
  }

  get context() {
    return getLoggerContext(this.logger);
  }

  get pairing() {
    return this.core.pairing.pairings;
  }

  // ---------- Events ----------------------------------------------- //

  public on: ISignClientEvents["on"] = (name, listener) => {
    this.assertActive();
    return this.events.on(name, listener);
  };

  public once: ISignClientEvents["once"] = (name, listener) => {
    this.assertActive();
    return this.events.once(name, listener);
  };

  public off: ISignClientEvents["off"] = (name, listener) => {
    return this.events.off(name, listener);
  };

  public removeListener: ISignClientEvents["removeListener"] = (name, listener) => {
    return this.events.removeListener(name, listener);
  };

  public removeAllListeners: ISignClientEvents["removeAllListeners"] = (name) => {
    return this.events.removeAllListeners(name);
  };

  // ---------- Engine ----------------------------------------------- //

  public connect: ISignClient["connect"] = async (params) => {
    try {
      return await this.run(() => this.engine.connect(params));
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public pair: ISignClient["pair"] = async (params) => {
    try {
      return await this.run(() => this.engine.pair(params));
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public approve: ISignClient["approve"] = async (params) => {
    try {
      return await this.run(() => this.engine.approve(params));
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public reject: ISignClient["reject"] = async (params) => {
    try {
      return await this.run(() => this.engine.reject(params));
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public update: ISignClient["update"] = async (params) => {
    try {
      return await this.run(() => this.engine.update(params));
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public extend: ISignClient["extend"] = async (params) => {
    try {
      return await this.run(() => this.engine.extend(params));
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public request: ISignClient["request"] = async <T>(params: EngineTypes.RequestParams) => {
    try {
      return await this.run(() => this.engine.request<T>(params));
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public respond: ISignClient["respond"] = async (params) => {
    try {
      return await this.run(() => this.engine.respond(params));
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public ping: ISignClient["ping"] = async (params) => {
    try {
      return await this.run(() => this.engine.ping(params));
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public emit: ISignClient["emit"] = async (params) => {
    try {
      return await this.run(() => this.engine.emit(params));
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public disconnect: ISignClient["disconnect"] = async (params) => {
    try {
      return await this.run(() => this.engine.disconnect(params));
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public find: ISignClient["find"] = (params) => {
    try {
      this.assertActive();
      return this.engine.find(params);
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public getPendingSessionRequests: ISignClient["getPendingSessionRequests"] = () => {
    try {
      this.assertActive();
      return this.engine.getPendingSessionRequests();
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  /**
   * @deprecated `authenticate` is deprecated and will be removed in a future release.
   * Use `connect()`'s `authentication` instead to establish an authenticated session.
   */
  public authenticate: ISignClient["authenticate"] = async (params, walletUniversalLink) => {
    try {
      console.warn(
        "[WalletConnect] `authenticate` is deprecated and will be removed in a future release. Use `connect()`'s `authentication` instead to establish an authenticated session.",
      );
      return await this.run(() => this.engine.authenticate(params, walletUniversalLink));
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public formatAuthMessage: ISignClient["formatAuthMessage"] = (params) => {
    try {
      this.assertActive();
      return this.engine.formatAuthMessage(params);
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public approveSessionAuthenticate: ISignClient["approveSessionAuthenticate"] = async (params) => {
    try {
      return await this.run(() => this.engine.approveSessionAuthenticate(params));
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public rejectSessionAuthenticate: ISignClient["rejectSessionAuthenticate"] = async (params) => {
    try {
      return await this.run(() => this.engine.rejectSessionAuthenticate(params));
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  // ---------- Private ----------------------------------------------- //

  private async initialize() {
    this.assertActive();
    this.logger.trace(`Initialized`);
    try {
      await this.run(() => this.core.start());
      await this.run(() => this.session.init());
      await this.run(() => this.proposal.init());
      await this.run(() => this.pendingRequest.init());
      await this.run(() => this.auth.init());
      await this.run(() => this.engine.init());
      this.logger.info(`SignClient Initialization Success`);
    } catch (error: any) {
      this.logger.info(`SignClient Initialization Failure`);
      this.logger.error(error.message);
      throw error;
    }
  }
}
