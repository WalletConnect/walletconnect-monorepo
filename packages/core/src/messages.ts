import { Logger } from "pino";
import { generateChildLogger, getLoggerContext } from "@walletconnect/logger";
import { IRelayerStorage, IMessageTracker, MessageRecord } from "@walletconnect/types";
import { formatMessageContext, sha256 } from "@walletconnect/utils";

import { MESSAGES_CONTEXT } from "./constants";

export class MessageTracker extends IMessageTracker {
  public messages = new Map<string, MessageRecord>();

  public name = MESSAGES_CONTEXT;

  constructor(public logger: Logger, public storage: IRelayerStorage) {
    super(logger, storage);
    this.logger = generateChildLogger(logger, this.name);
    this.storage = storage;
  }

  get context(): string {
    return getLoggerContext(this.logger);
  }

  public async init(): Promise<void> {
    this.logger.trace(`Initialized`);
    await this.initialize();
  }

  public async set(topic: string, message: string): Promise<string> {
    const hash = await sha256(message);
    let messages = this.messages.get(topic);
    if (typeof messages === "undefined") {
      messages = {};
    }
    if (typeof messages[hash] !== "undefined") {
      return hash;
    }
    messages[hash] = message;
    this.messages.set(topic, messages);
    await this.persist();
    return hash;
  }

  public async get(topic: string): Promise<MessageRecord> {
    let messages = this.messages.get(topic);
    if (typeof messages === "undefined") {
      messages = {};
    }
    return messages;
  }

  public async has(topic: string, message: string): Promise<boolean> {
    const messages = this.get(topic);
    const hash = await sha256(message);
    return typeof messages[hash] !== "undefined";
  }

  public async del(topic: string) {
    this.messages.delete(topic);
    await this.persist();
  }

  // ---------- Private ----------------------------------------------- //

  private async persist() {
    await this.storage.setRelayerMessages(this.context, this.messages);
  }

  private async restore() {
    try {
      const messages = await this.storage.getRelayerMessages(this.context);
      if (typeof messages !== "undefined") {
        this.messages = messages;
      }
      this.logger.debug(`Successfully Restored records for ${formatMessageContext(this.context)}`);
      this.logger.trace({ type: "method", method: "restore", size: this.messages.size });
    } catch (e) {
      this.logger.debug(`Failed to Restore records for ${formatMessageContext(this.context)}`);
      this.logger.error(e as any);
    }
  }

  private async initialize() {
    await this.restore();
  }
}
