import { EventEmitter } from "events";
import { Core } from "@walletconnect/core";
import {
  SignClientTypes,
  ISignClient,
  ISignClientEvents,
  EngineTypes,
  SessionTypes,
} from "@walletconnect/types";
import {
  populateAppMetadata,
  createLogger,
  engineEvent,
  getSdkError,
  hashKey,
} from "@walletconnect/utils";
import { getLoggerContext } from "@walletconnect/logger";
import {
  SIGN_CLIENT_DEFAULT,
  SIGN_CLIENT_PROTOCOL,
  SIGN_CLIENT_VERSION,
} from "./constants/index.js";
import { AuthStore, Engine, PendingRequest, Proposal, Session } from "./controllers/index.js";
import { SignV3Error, V3Client } from "./v3/client.js";

const uriParam = (uri: string, name: string) =>
  new URLSearchParams(uri.slice(uri.indexOf("?"))).get(name);

// A v3 connection id is a region digit and a random u64; a v2 topic is 64 hex characters.
const isV3Topic = (topic: string) => /^[0-2]\d{1,20}$/.test(topic);

/**
 * Speaks Sign v2 and Sign v3. A connection uses v3 when both sides speak it, and v2 otherwise:
 * - `connect()` offers both on one URI, and the first answer settles it;
 * - `pair()` uses v3 when the URI has the `v3` parameter, and v2 otherwise;
 * - every other call goes to the engine that owns the session or proposal.
 */
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
  private readonly appSignature?: SignClientTypes.Options["appSignature"];

  private v3?: V3Client;
  // v3 offers that lost to v2: a session that still arrives on one is closed
  private readonly cancelledV3 = new Set<string>();

  static async init(opts?: SignClientTypes.Options) {
    const client = new SignClient(opts);
    await client.initialize();

    return client;
  }

  constructor(opts?: SignClientTypes.Options) {
    super(opts);

    this.name = opts?.name || SIGN_CLIENT_DEFAULT.name;
    this.metadata = populateAppMetadata(opts?.metadata);
    this.signConfig = opts?.signConfig;
    this.appSignature = opts?.appSignature;

    const logger = createLogger({
      logger: opts?.logger || SIGN_CLIENT_DEFAULT.logger,
      name: this.name,
    });
    this.logger = logger;
    this.core = opts?.core || new Core(opts);
    const v2Sessions = new Session(this.core, this.logger);
    this.session = this.withV3Sessions(v2Sessions);
    this.proposal = new Proposal(this.core, this.logger);
    this.pendingRequest = new PendingRequest(this.core, this.logger);
    // the v2 engine works on the v2 sessions alone
    this.engine = new Engine(Object.create(this, { session: { value: v2Sessions } }));
    this.auth = new AuthStore(this.core, this.logger);
  }

  get context() {
    return getLoggerContext(this.logger);
  }

  get pairing() {
    return this.core.pairing.pairings;
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

  public removeAllListeners: ISignClientEvents["removeAllListeners"] = (name) => {
    return this.events.removeAllListeners(name);
  };

  // ---------- Engine ----------------------------------------------- //

  public connect: ISignClient["connect"] = async (params) => {
    try {
      // a v3 proposal carries none of these
      if (!this.v3 || params?.pairingTopic || params?.authentication || params?.walletPay) {
        return await this.engine.connect(params);
      }
      return await this.connectBoth(this.v3, params);
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public pair: ISignClient["pair"] = async (params) => {
    try {
      if (this.v3 && uriParam(params?.uri ?? "", "v3")) return await this.v3.pair(params);
      return await this.engine.pair(params);
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public approve: ISignClient["approve"] = async (params) => {
    try {
      if (this.v3?.hasProposal(params?.id)) return await this.v3.approve(params);
      return await this.engine.approve(params);
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public reject: ISignClient["reject"] = async (params) => {
    try {
      if (this.v3?.hasProposal(params?.id)) return await this.v3.reject(params);
      return await this.engine.reject(params);
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public update: ISignClient["update"] = async (params) => {
    try {
      const v3 = this.v3For(params?.topic);
      if (v3) return await v3.update(params);
      return await this.engine.update(params);
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public extend: ISignClient["extend"] = async (params) => {
    try {
      const v3 = this.v3For(params?.topic);
      if (v3) return await v3.extend(params);
      return await this.engine.extend(params);
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public request: ISignClient["request"] = async <T>(params: EngineTypes.RequestParams) => {
    try {
      const v3 = this.v3For(params?.topic);
      if (v3) return await v3.request<T>(params);
      return await this.engine.request<T>(params);
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public respond: ISignClient["respond"] = async (params) => {
    try {
      const v3 = this.v3For(params?.topic);
      if (v3) return await v3.respond(params);
      return await this.engine.respond(params);
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public ping: ISignClient["ping"] = async (params) => {
    try {
      const v3 = this.v3For(params?.topic);
      if (v3) return await v3.ping(params);
      return await this.engine.ping(params);
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public emit: ISignClient["emit"] = async (params) => {
    try {
      const v3 = this.v3For(params?.topic);
      if (v3) return await v3.emit(params);
      return await this.engine.emit(params);
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public disconnect: ISignClient["disconnect"] = async (params) => {
    try {
      const v3 = this.v3For(params?.topic);
      if (v3) return await v3.disconnect(params);
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

  public getPendingSessionRequests: ISignClient["getPendingSessionRequests"] = () => {
    try {
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
      return await this.engine.authenticate(params, walletUniversalLink);
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public formatAuthMessage: ISignClient["formatAuthMessage"] = (params) => {
    try {
      return this.engine.formatAuthMessage(params);
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public approveSessionAuthenticate: ISignClient["approveSessionAuthenticate"] = async (params) => {
    try {
      return await this.engine.approveSessionAuthenticate(params);
    } catch (error: any) {
      this.logger.error(error.message);
      throw error;
    }
  };

  public rejectSessionAuthenticate: ISignClient["rejectSessionAuthenticate"] = async (params) => {
    try {
      return await this.engine.rejectSessionAuthenticate(params);
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
      await this.session.init();
      await this.proposal.init();
      await this.pendingRequest.init();
      await this.auth.init();
      await this.engine.init();
      await this.initV3();
      this.logger.info(`SignClient Initialization Success`);
    } catch (error: any) {
      this.logger.info(`SignClient Initialization Failure`);
      this.logger.error(error.message);
      throw error;
    }
  }

  private async initV3() {
    // React Native has no WebAssembly
    if (typeof WebAssembly === "undefined") return;
    try {
      this.v3 = await V3Client.init(
        {
          projectId: this.core.projectId,
          relayUrl: this.core.relayUrl,
          metadata: this.metadata,
          storage: this.core.storage,
          // core's prefix starts with ":", and the storage collapses "::" in keys
          customStoragePrefix: this.core.customStoragePrefix.replace(/^:/, ""),
          appSignature: this.appSignature,
        },
        this.onV3Event,
      );
    } catch (error: any) {
      this.logger.warn(error, "Sign v3 is unavailable, using v2 only");
    }
  }

  private v3For(topic?: string) {
    return topic && isV3Topic(topic) ? this.v3 : undefined;
  }

  // The app sees the sessions of both protocols; writes go to the v2 store.
  private withV3Sessions(sessions: Session): Session {
    const v3 = () => this.v3?.session;
    return new Proxy(sessions, {
      get: (target, prop) => {
        switch (prop) {
          case "getAll":
            return (filter?: Parameters<Session["getAll"]>[0]) => [
              ...target.getAll(filter),
              ...(filter ? [] : (v3()?.getAll() ?? [])),
            ];
          case "get":
            return (topic: string) =>
              isV3Topic(topic) && this.v3 ? this.v3.session.get(topic) : target.get(topic);
          case "keys":
            return [...target.keys, ...(v3()?.keys ?? [])];
          case "values":
            return [...target.values, ...(v3()?.getAll() ?? [])];
          case "length":
            return target.length + (v3()?.keys.length ?? 0);
        }
        const value = Reflect.get(target, prop, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  }

  private async connectBoth(v3: V3Client, params: EngineTypes.ConnectParams) {
    let offer: Awaited<ReturnType<V3Client["connect"]>>;
    try {
      offer = await v3.connect(params);
    } catch (error: any) {
      // The app refused to sign: falling back to v2 would send the proposal unsigned.
      if (error instanceof SignV3Error && error.code === "app_signature_failed") throw error;
      this.logger.warn(error, "v3 connect failed, offering v2 only");
      return await this.engine.connect(params);
    }
    const uri = offer.uri as string;
    const connectionId = uriParam(uri, "v3") as string;
    const symKey = uriParam(uri, "symKey") as string;
    let fallback: Awaited<ReturnType<ISignClient["connect"]>>;
    try {
      fallback = await this.engine.connect({ ...params, symKey });
    } catch (error: any) {
      this.logger.warn(error, "v2 connect failed, offering v3 only");
      return offer;
    }

    const dropV2 = () => {
      this.dropV2Offer(hashKey(symKey));
    };
    const dropV3 = () => {
      this.cancelledV3.add(connectionId);
    };
    const approval = new Promise<SessionTypes.Struct>((resolve, reject) => {
      let settled = false;
      const first = (dropOther: () => void, settle: () => void) => {
        if (settled) return;
        settled = true;
        dropOther();
        settle();
      };
      offer.approval().then(
        (session) => first(dropV2, () => resolve(session)),
        (error) => first(dropV2, () => reject(error)),
      );
      fallback.approval().then(
        (session) => first(dropV3, () => resolve(session)),
        (error) => first(dropV3, () => reject(error)),
      );
    });
    approval.catch(() => undefined);
    return { uri, approval: () => approval };
  }

  private onV3Event = <E extends SignClientTypes.Event>(
    name: E,
    args: SignClientTypes.EventArguments[E],
  ) => {
    if (name === "session_connect") {
      const { topic } = (args as SignClientTypes.EventArguments["session_connect"]).session;
      if (this.cancelledV3.delete(topic)) {
        this.v3
          ?.disconnect({ topic, reason: getSdkError("USER_DISCONNECTED") })
          .catch((error) => this.logger.warn(error));
        return;
      }
    }
    this.events.emit(name, args);
  };

  private async dropV2Offer(pairingTopic: string) {
    const reason = getSdkError("USER_DISCONNECTED");
    try {
      const proposals = this.proposal.getAll().filter((p) => p.pairingTopic === pairingTopic);
      for (const { id } of proposals) {
        await this.proposal.delete(id, reason);
        this.core.expirer.del(id);
        // settles connect()'s approval, which removes the engine's listeners for the proposal
        (this.engine as unknown as { events: EventEmitter }).events.emit(
          engineEvent("session_connect", id),
          { error: reason },
        );
      }
      await this.core.relayer.unsubscribe(pairingTopic);
      await this.core.pairing.pairings.delete(pairingTopic, reason);
      await this.core.crypto.deleteSymKey(pairingTopic);
      this.core.expirer.del(pairingTopic);
    } catch (error: any) {
      this.logger.warn(error);
    }
  }
}
