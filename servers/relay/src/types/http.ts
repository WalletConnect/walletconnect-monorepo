import { RequestGenericInterface } from "fastify";

import { RelayModes } from "./relay";

export interface HttpServiceConfig {
  logger: string;
  port: number;
  host: string;
  redis: {
    url: string;
  };
  mode: RelayModes.All;
  waku: {
    env: string;
    url: string | undefined;
  };
  maxTTL: number;
  gitHash: string;
  version: any;
}

export interface PostSubscribeRequest extends RequestGenericInterface {
  Body: {
    topic: string;
    webhook: string;
  };
}
