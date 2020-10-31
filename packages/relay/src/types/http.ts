import { RequestGenericInterface } from "fastify";
import { Logger } from "pino";

export interface HttpServiceOptions {
  port: number;
  host: string;
  logger?: string | Logger;
}

export interface PostSubscribeRequest extends RequestGenericInterface {
  Body: {
    topic: string;
    webhook: string;
  };
}
