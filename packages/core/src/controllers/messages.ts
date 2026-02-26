import { generateChildLogger, getLoggerContext, Logger } from "@walletconnect/logger";
import { ICore, IMessageTracker, MessageRecord } from "@walletconnect/types";
import { hashMessage, mapToObj, objToMap, getInternalError } from "@walletconnect/utils";
import {
  CORE_STORAGE_PREFIX,
  MESSAGE_DIRECTION,
  MESSAGES_CONTEXT,
  MESSAGES_STORAGE_VERSION,
} from "../constants/index.js";

export class MessageTracker extends IMessageTracker {
  public messages = new Map<string, MessageRecord>();
  /**
   * stores messages that have not been acknowledged by the implementing client
   * this is used to prevent losing messages in race conditions such as
   * when a message is received by the relayer before the implementing client is ready to receive it
   */
  public messagesWithoutClientAck = new Map<string, MessageRecord>();
  public name = MESSAGES_CONTEXT;
  public version = MESSAGES_STORAGE_VERSION;

  private initialized = false;
  private storagePrefix = CORE_STORAGE_PREFIX;

  constructor(
    public logger: Logger,
    public core: ICore,
  ) {
    super(logger, core);
    this.logger = generateChildLogger(logger, this.name);
    this.core = core;
  }

  public init: IMessageTracker["init"] = async () => {
    if (!this.initialized) {
      this.logger.trace(`Initialized`);
      try {
        const messages = await this.getRelayerMessages();
        if (typeof messages !== "undefined") {
          this.messages = messages;
        }
        const messagesWithoutClientAck = await this.getRelayerMessagesWithoutClientAck();
        if (typeof messagesWithoutClientAck !== "undefined") {
          this.messagesWithoutClientAck = messagesWithoutClientAck;
        }
        this.logger.debug(`Successfully Restored records for ${this.name}`);
        this.logger.trace({ type: "method", method: "restore", size: this.messages.size });
      } catch (e) {
        this.logger.debug(`Failed to Restore records for ${this.name}`);
        this.logger.error(e as any);
      } finally {
        this.initialized = true;
      }
    }
  };

  get context(): string {
    return getLoggerContext(this.logger);
  }

  get storageKey() {
    return this.storagePrefix + this.version + this.core.customStoragePrefix + "//" + this.name;
  }

  get storageKeyWithoutClientAck() {
    return (
      this.storagePrefix +
      this.version +
      this.core.customStoragePrefix +
      "//" +
      this.name +
      "_withoutClientAck"
    );
  }

  public set: IMessageTracker["set"] = async (topic, message, direction) => {
    this.isInitialized();
    const hash = hashMessage(message);
    let messages = this.messages.get(topic);
    if (typeof messages === "undefined") {
      messages = {};
    }
    if (typeof messages[hash] !== "undefined") {
      return hash;
    }
    messages[hash] = message;
    this.messages.set(topic, messages);
    // Only store messages without client ack for inbound messages
    if (direction === MESSAGE_DIRECTION.inbound) {
      const messagesWithoutClientAck = this.messagesWithoutClientAck.get(topic) || {};
      this.messagesWithoutClientAck.set(topic, {
        ...messagesWithoutClientAck,
        [hash]: message,
      });
    }

    await this.persist();
    return hash;
  };

  public get: IMessageTracker["get"] = (topic) => {
    this.isInitialized();
    let messages = this.messages.get(topic);
    if (typeof messages === "undefined") {
      messages = {};
    }
    return messages;
  };

  public getWithoutAck: IMessageTracker["getWithoutAck"] = (topics) => {
    this.isInitialized();
    const messages: Record<string, string[]> = {};
    for (const topic of topics) {
      const messagesWithoutClientAck = this.messagesWithoutClientAck.get(topic) || {};
      messages[topic] = Object.values(messagesWithoutClientAck);
    }
    return messages;
  };

  public has: IMessageTracker["has"] = (topic, message) => {
    this.isInitialized();
    const messages = this.get(topic);
    const hash = hashMessage(message);
    return typeof messages[hash] !== "undefined";
  };

  public ack: IMessageTracker["ack"] = async (topic, message) => {
    this.isInitialized();
    const messages = this.messagesWithoutClientAck.get(topic);
    if (typeof messages === "undefined") {
      return;
    }

    const hash = hashMessage(message);

    delete messages[hash];
    if (Object.keys(messages).length === 0) {
      this.messagesWithoutClientAck.delete(topic);
    } else {
      this.messagesWithoutClientAck.set(topic, messages);
    }
    await this.persist();
  };

  public del: IMessageTracker["del"] = async (topic) => {
    this.isInitialized();
    this.messages.delete(topic);
    this.messagesWithoutClientAck.delete(topic);
    await this.persist();
  };

  // ---------- Private ----------------------------------------------- //

  private async setRelayerMessages(messages: Map<string, MessageRecord>): Promise<void> {
    await this.core.storage.setItem<Record<string, MessageRecord>>(
      this.storageKey,
      mapToObj(messages),
    );
  }

  private async setRelayerMessagesWithoutClientAck(
    messages: Map<string, MessageRecord>,
  ): Promise<void> {
    await this.core.storage.setItem<Record<string, MessageRecord>>(
      this.storageKeyWithoutClientAck,
      mapToObj(messages),
    );
  }

  private async getRelayerMessages(): Promise<Map<string, MessageRecord> | undefined> {
    const messages = await this.core.storage.getItem<Record<string, MessageRecord>>(
      this.storageKey,
    );
    return typeof messages !== "undefined" ? objToMap(messages) : undefined;
  }

  private async getRelayerMessagesWithoutClientAck(): Promise<
    Map<string, MessageRecord> | undefined
  > {
    const messages = await this.core.storage.getItem<Record<string, MessageRecord>>(
      this.storageKeyWithoutClientAck,
    );
    return typeof messages !== "undefined" ? objToMap(messages) : undefined;
  }

  private async persist() {
    await this.setRelayerMessages(this.messages);
    await this.setRelayerMessagesWithoutClientAck(this.messagesWithoutClientAck);
  }

  private isInitialized() {
    if (!this.initialized) {
      const { message } = getInternalError("NOT_INITIALIZED", this.name);
      throw new Error(message);
    }
  }
}
