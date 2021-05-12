import { RequestGenericInterface } from "fastify";
import { Logger } from "pino";

export interface HttpServiceOptions {
  logger?: string | Logger;
}

export interface GetTestRequest extends RequestGenericInterface {
  Querystring: {
    url: string;
    legacy?: string;
  };
}
