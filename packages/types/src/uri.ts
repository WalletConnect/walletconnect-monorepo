import { RelayProtocolOptions } from "./relay";

export interface UriParameters {
  protocol: string;
  version: number;
  topic: string;
  publicKey: string;
  relay: RelayProtocolOptions;
}
