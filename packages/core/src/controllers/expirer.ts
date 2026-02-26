import { HEARTBEAT_EVENTS } from "@walletconnect/heartbeat";
import { generateChildLogger, getLoggerContext, Logger } from "@walletconnect/logger";
import { toMiliseconds } from "@walletconnect/time";
import { ExpirerTypes, ICore, IExpirer } from "@walletconnect/types";
import { getInternalError, formatIdTarget, formatTopicTarget } from "@walletconnect/utils";
import { EventEmitter } from "events";
import {
  CORE_STORAGE_PREFIX,
  EXPIRER_CONTEXT,
  EXPIRER_EVENTS,
  EXPIRER_STORAGE_VERSION,
} from "../constants/index.js";

export class Expirer extends IExpirer {
  public expirations = new Map<string, ExpirerTypes.Expiration>();
  public events = new EventEmitter();
  public name = EXPIRER_CONTEXT;
  public version = EXPIRER_STORAGE_VERSION;

  private cached: ExpirerTypes.Expiration[] = [];
  private initialized = false;

  private storagePrefix = CORE_STORAGE_PREFIX;

  constructor(
    public core: ICore,
    public logger: Logger,
  ) {
    super(core, logger);
    this.logger = generateChildLogger(logger, this.name);
  }

  public init: IExpirer["init"] = async () => {
    if (!this.initialized) {
      this.logger.trace(`Initialized`);
      await this.restore();
      this.cached.forEach((expiration) => this.expirations.set(expiration.target, expiration));
      this.cached = [];
      this.registerEventListeners();
      this.initialized = true;
    }
  };

  get context(): string {
    return getLoggerContext(this.logger);
  }

  get storageKey() {
    return this.storagePrefix + this.version + this.core.customStoragePrefix + "//" + this.name;
  }

  get length(): number {
    return this.expirations.size;
  }

  get keys(): string[] {
    return Array.from(this.expirations.keys());
  }

  get values(): ExpirerTypes.Expiration[] {
    return Array.from(this.expirations.values());
  }

  public has: IExpirer["has"] = (key) => {
    try {
      const target = this.formatTarget(key);
      const expiration = this.getExpiration(target);
      return typeof expiration !== "undefined";
    } catch (e) {
      // ignore
      return false;
    }
  };

  public set: IExpirer["set"] = (key, expiry) => {
    this.isInitialized();
    const target = this.formatTarget(key);
    const expiration = { target, expiry };
    this.expirations.set(target, expiration);
    this.checkExpiry(target, expiration);
    this.events.emit(EXPIRER_EVENTS.created, {
      target,
      expiration,
    } as ExpirerTypes.Created);
  };

  public get: IExpirer["get"] = (key) => {
    this.isInitialized();
    const target = this.formatTarget(key);
    return this.getExpiration(target);
  };

  public del: IExpirer["del"] = (key) => {
    this.isInitialized();
    const exists = this.has(key);
    if (exists) {
      const target = this.formatTarget(key);
      const expiration = this.getExpiration(target);
      this.expirations.delete(target);
      this.events.emit(EXPIRER_EVENTS.deleted, {
        target,
        expiration,
      } as ExpirerTypes.Deleted);
    }
  };

  public on: IExpirer["on"] = (event, listener) => {
    this.events.on(event, listener);
  };

  public once: IExpirer["once"] = (event, listener) => {
    this.events.once(event, listener);
  };

  public off: IExpirer["off"] = (event, listener) => {
    this.events.off(event, listener);
  };

  public removeListener: IExpirer["removeListener"] = (event, listener) => {
    this.events.removeListener(event, listener);
  };

  // ---------- Private ----------------------------------------------- //

  private formatTarget(key: string | number) {
    if (typeof key === "string") {
      return formatTopicTarget(key);
    } else if (typeof key === "number") {
      return formatIdTarget(key);
    }
    const { message } = getInternalError("UNKNOWN_TYPE", `Target type: ${typeof key}`);
    throw new Error(message);
  }

  private async setExpirations(expirations: ExpirerTypes.Expiration[]): Promise<void> {
    await this.core.storage.setItem<ExpirerTypes.Expiration[]>(this.storageKey, expirations);
  }

  private async getExpirations(): Promise<ExpirerTypes.Expiration[] | undefined> {
    const expirations = await this.core.storage.getItem<ExpirerTypes.Expiration[]>(this.storageKey);
    return expirations;
  }

  private async persist() {
    await this.setExpirations(this.values);
    this.events.emit(EXPIRER_EVENTS.sync);
  }

  private async restore() {
    try {
      const persisted = await this.getExpirations();
      if (typeof persisted === "undefined") return;
      if (!persisted.length) return;
      if (this.expirations.size) {
        const { message } = getInternalError("RESTORE_WILL_OVERRIDE", this.name);
        this.logger.error(message);
        throw new Error(message);
      }
      this.cached = persisted;
      this.logger.debug(`Successfully Restored expirations for ${this.name}`);
      this.logger.trace({ type: "method", method: "restore", expirations: this.values });
    } catch (e) {
      this.logger.debug(`Failed to Restore expirations for ${this.name}`);
      this.logger.error(e as any);
    }
  }

  private getExpiration(target: string): ExpirerTypes.Expiration {
    const expiration = this.expirations.get(target);
    if (!expiration) {
      const { message } = getInternalError("NO_MATCHING_KEY", `${this.name}: ${target}`);
      this.logger.warn(message);
      throw new Error(message);
    }
    return expiration;
  }

  private checkExpiry(target: string, expiration: ExpirerTypes.Expiration): void {
    const { expiry } = expiration;
    const msToTimeout = toMiliseconds(expiry) - Date.now();
    if (msToTimeout <= 0) this.expire(target, expiration);
  }

  private expire(target: string, expiration: ExpirerTypes.Expiration): void {
    this.expirations.delete(target);
    this.events.emit(EXPIRER_EVENTS.expired, {
      target,
      expiration,
    } as ExpirerTypes.Expired);
  }

  private checkExpirations(): void {
    // avoid auto expiring if the relayer is not connected
    if (!this.core.relayer.connected) return;
    this.expirations.forEach((expiration, target) => this.checkExpiry(target, expiration));
  }

  private registerEventListeners(): void {
    this.core.heartbeat.on(HEARTBEAT_EVENTS.pulse, () => this.checkExpirations());
    this.events.on(EXPIRER_EVENTS.created, (createdEvent: ExpirerTypes.Created) => {
      const eventName = EXPIRER_EVENTS.created;
      this.logger.info(`Emitting ${eventName}`);
      this.logger.debug({ type: "event", event: eventName, data: createdEvent });
      this.persist();
    });
    this.events.on(EXPIRER_EVENTS.expired, (expiredEvent: ExpirerTypes.Expired) => {
      const eventName = EXPIRER_EVENTS.expired;
      this.logger.info(`Emitting ${eventName}`);
      this.logger.debug({ type: "event", event: eventName, data: expiredEvent });
      this.persist();
    });
    this.events.on(EXPIRER_EVENTS.deleted, (deletedEvent: ExpirerTypes.Deleted) => {
      const eventName = EXPIRER_EVENTS.deleted;
      this.logger.info(`Emitting ${eventName}`);
      this.logger.debug({ type: "event", event: eventName, data: deletedEvent });
      this.persist();
    });
  }

  private isInitialized() {
    if (!this.initialized) {
      const { message } = getInternalError("NOT_INITIALIZED", this.name);
      throw new Error(message);
    }
  }
}
