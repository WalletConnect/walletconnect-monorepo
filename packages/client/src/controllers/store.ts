import { EventEmitter } from "events";
import { Logger } from "pino";
import { IClient, IStore, Reason, StoreEvent } from "@walletconnect/types";
import { ERROR, formatMessageContext, formatStorageKeyName } from "@walletconnect/utils";

import { STORE_EVENTS, STORE_STORAGE_VERSION } from "../constants";
import { generateChildLogger, getLoggerContext } from "@walletconnect/logger";

export class Store<Sequence = any> extends IStore<Sequence> {
  public sequences = new Map<string, Sequence>();

  public events = new EventEmitter();

  public version: string = STORE_STORAGE_VERSION;

  private cached: Sequence[] = [];

  constructor(public client: IClient, public logger: Logger, public name: string) {
    super(client, logger, name);
    this.logger = generateChildLogger(logger, this.name);

    this.registerEventListeners();
  }

  public async init(): Promise<void> {
    this.logger.trace(`Initialized`);
    await this.initialize();
  }

  get context(): string {
    return getLoggerContext(this.logger);
  }

  get storageKey(): string {
    return this.client.storagePrefix + this.version + "//" + formatStorageKeyName(this.context);
  }

  get length(): number {
    return this.sequences.size;
  }

  get topics(): string[] {
    return Array.from(this.sequences.keys());
  }

  get values(): Sequence[] {
    return Array.from(this.sequences.values());
  }

  public async set(topic: string, sequence: Sequence): Promise<void> {
    await this.isInitialized();
    if (this.sequences.has(topic)) {
      this.update(topic, sequence);
    } else {
      this.logger.debug(`Setting sequence`);
      this.logger.trace({ type: "method", method: "set", topic, sequence });
      this.sequences.set(topic, sequence);
      this.events.emit(STORE_EVENTS.created, {
        topic,
        sequence,
      } as StoreEvent.Created<Sequence>);
    }
  }

  public async get(topic: string): Promise<Sequence> {
    await this.isInitialized();
    this.logger.debug(`Getting sequence`);
    this.logger.trace({ type: "method", method: "get", topic });
    const sequence = await this.getSequence(topic);
    return sequence;
  }

  public async update(topic: string, update: Partial<Sequence>): Promise<void> {
    await this.isInitialized();
    this.logger.debug(`Updating sequence`);
    this.logger.trace({ type: "method", method: "update", topic, update });
    const sequence = { ...(await this.getSequence(topic)), ...update };
    this.sequences.set(topic, sequence);
    this.events.emit(STORE_EVENTS.updated, {
      topic,
      sequence,
      update,
    } as StoreEvent.Updated<Sequence>);
  }

  public async delete(topic: string, reason: Reason): Promise<void> {
    await this.isInitialized();
    if (!this.sequences.has(topic)) return;
    this.logger.debug(`Deleting sequence`);
    this.logger.trace({ type: "method", method: "delete", topic, reason });
    const sequence = await this.getSequence(topic);
    this.sequences.delete(topic);
    this.events.emit(STORE_EVENTS.deleted, {
      topic,
      sequence,
      reason,
    } as StoreEvent.Deleted<Sequence>);
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

  // ---------- Private ----------------------------------------------- //

  private async setSequenceStore<Sequence = any>(sequences: Sequence[]): Promise<void> {
    await this.client.keyValueStorage.setItem<Sequence[]>(this.storageKey, sequences);
  }

  private async getSequenceStore<Sequence = any>(): Promise<Sequence[] | undefined> {
    const sequences = await this.client.keyValueStorage.getItem<Sequence[]>(this.storageKey);
    return sequences;
  }

  private async getSequence(topic: string): Promise<Sequence> {
    await this.isInitialized();
    const sequence = this.sequences.get(topic);
    if (!sequence) {
      const error = ERROR.NO_MATCHING_TOPIC.format({
        context: formatMessageContext(this.context),
        topic,
      });
      this.logger.error(error.message);
      throw new Error(error.message);
    }
    return sequence;
  }

  private async persist() {
    await this.setSequenceStore(this.values);
    this.events.emit(STORE_EVENTS.sync);
  }

  private async restore() {
    try {
      const persisted = await this.getSequenceStore();
      if (typeof persisted === "undefined") return;
      if (!persisted.length) return;
      if (this.sequences.size) {
        const error = ERROR.RESTORE_WILL_OVERRIDE.format({
          context: formatMessageContext(this.context),
        });
        this.logger.error(error.message);
        throw new Error(error.message);
      }
      this.cached = persisted;
      this.logger.debug(
        `Successfully Restored sequences for ${formatMessageContext(this.context)}`,
      );
      this.logger.trace({ type: "method", method: "restore", sequences: this.values });
    } catch (e) {
      this.logger.debug(`Failed to Restore sequences for ${formatMessageContext(this.context)}`);
      this.logger.error(e as any);
    }
  }

  private async initialize() {
    await this.restore();
    this.reset();
    this.onInit();
  }

  private reset() {
    this.cached.forEach(sequence => this.sequences.set((sequence as any).topic, sequence));
  }

  private onInit() {
    this.cached = [];
    this.events.emit(STORE_EVENTS.init);
  }

  private async isInitialized(): Promise<void> {
    if (!this.cached.length) return;
    return new Promise(resolve => {
      this.events.once(STORE_EVENTS.init, () => resolve());
    });
  }

  private registerEventListeners(): void {
    this.events.on(STORE_EVENTS.created, (createdEvent: StoreEvent.Created<Sequence>) => {
      const eventName = STORE_EVENTS.created;
      this.logger.info(`Emitting ${eventName}`);
      this.logger.debug({ type: "event", event: eventName, data: createdEvent });
      this.persist();
    });
    this.events.on(STORE_EVENTS.updated, (updatedEvent: StoreEvent.Updated<Sequence>) => {
      const eventName = STORE_EVENTS.updated;
      this.logger.info(`Emitting ${eventName}`);
      this.logger.debug({ type: "event", event: eventName, data: updatedEvent });
      this.persist();
    });
    this.events.on(STORE_EVENTS.deleted, (deletedEvent: StoreEvent.Deleted<Sequence>) => {
      const eventName = STORE_EVENTS.deleted;
      this.logger.info(`Emitting ${eventName}`);
      this.logger.debug({ type: "event", event: eventName, data: deletedEvent });
      this.persist();
    });
  }
}
