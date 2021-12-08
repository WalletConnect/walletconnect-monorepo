import { Logger } from "pino";
import * as encoding from "@walletconnect/encoding";
import { generateChildLogger, getLoggerContext } from "@walletconnect/logger";
import { JsonRpcPayload } from "@walletconnect/jsonrpc-utils";
import { safeJsonParse, safeJsonStringify } from "@walletconnect/safe-json";
import { IClient, IEncoder, IRelayerEncoder } from "@walletconnect/types";

import { ENCODER_CONTEXT } from "../constants";

export class Encoder implements IEncoder {
  public name: string = ENCODER_CONTEXT;

  constructor(public client: IClient, public logger: Logger) {
    this.client = client;
    this.logger = generateChildLogger(logger, this.name);
  }

  get context(): string {
    return getLoggerContext(this.logger);
  }

  public async encode(topic: string, payload: JsonRpcPayload): Promise<string> {
    const message = safeJsonStringify(payload);
    const hasKeys = await this.client.crypto.hasKeys(topic);
    const result = hasKeys
      ? await this.client.crypto.encrypt(topic, message)
      : encoding.utf8ToHex(message);
    return result;
  }

  public async decode(topic: string, encrypted: string): Promise<JsonRpcPayload> {
    const hasKeys = await this.client.crypto.hasKeys(topic);
    const message = hasKeys
      ? await this.client.crypto.decrypt(topic, encrypted)
      : encoding.hexToUtf8(encrypted);
    const payload = safeJsonParse(message);
    return payload;
  }
}

export class RelayerEncoder implements IRelayerEncoder {
  public async encode(topic: string, payload: JsonRpcPayload) {
    return encoding.utf8ToHex(safeJsonStringify(payload));
  }

  public async decode(topic: string, message: string) {
    return safeJsonParse(encoding.hexToUtf8(message));
  }
}
