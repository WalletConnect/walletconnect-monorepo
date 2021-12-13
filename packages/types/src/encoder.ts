import { Logger } from "pino";
import { JsonRpcPayload } from "@walletconnect/jsonrpc-types";

import { IClient } from "./client";
import { IRelayerEncoder } from "./relayer";

export abstract class IEncoder implements IRelayerEncoder {
  public abstract name: string;

  public abstract readonly context: string;

  constructor(public client: IClient, public logger: Logger) {}

  public abstract encode(topic: string, payload: JsonRpcPayload): Promise<string>;

  public abstract decode(topic: string, encrypted: string): Promise<JsonRpcPayload>;
}
