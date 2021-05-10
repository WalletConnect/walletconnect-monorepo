import { RequestGenericInterface } from "fastify";
import { Logger } from "pino";

export interface HttpServiceOptions {
  logger?: string | Logger;
}

export interface PostTestRequest extends RequestGenericInterface {
  Body: {
    relayProvider: string;
    legacy?: boolean;
  };
}
