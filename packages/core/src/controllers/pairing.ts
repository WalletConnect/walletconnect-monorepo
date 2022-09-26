import { generateChildLogger, getLoggerContext } from "@walletconnect/logger";
import { ICore, PairingTypes, IPairing, IStore } from "@walletconnect/types";
import { getInternalError } from "@walletconnect/utils";
import { Logger } from "pino";
import { PAIRING_CONTEXT, PAIRING_STORAGE_VERSION, CORE_STORAGE_PREFIX } from "../constants";
import { Store } from "../controllers/store";

// @ts-expect-error - other methods still to be added.
export class Pairing implements IPairing {
  public name = PAIRING_CONTEXT;
  public version = PAIRING_STORAGE_VERSION;

  public pairings: IStore<string, PairingTypes.Struct>;

  private initialized = false;
  private storagePrefix = CORE_STORAGE_PREFIX;

  constructor(public core: ICore, public logger: Logger) {
    this.core = core;
    this.logger = generateChildLogger(logger, this.name);
    this.pairings = new Store(this.core, this.logger, this.name, this.storagePrefix);
  }

  public init: IPairing["init"] = async () => {
    if (!this.initialized) {
      this.logger.trace(`Initialized`);
      await this.pairings.init();
      this.initialized = true;
    }
  };

  get context() {
    return getLoggerContext(this.logger);
  }

  // ---------- Private ----------------------------------------------- //

  // @ts-expect-error - will be used with once methods are implemented.
  private isInitialized() {
    if (!this.initialized) {
      const { message } = getInternalError("NOT_INITIALIZED", this.name);
      throw new Error(message);
    }
  }
}
