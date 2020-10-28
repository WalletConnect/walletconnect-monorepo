import { RelayTypes } from "./relay";

export interface UriParameters {
  protocol: string;
  version: number;
  topic: string;
  publicKey: string;
  relay: RelayTypes.ProtocolOptions;
}
