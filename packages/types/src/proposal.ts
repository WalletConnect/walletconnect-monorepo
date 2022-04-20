import { ClientTypes } from "./client";
import { RelayerTypes } from "./relayer";
import { SessionTypes } from "./session";
import { IStore } from "./store";

export declare namespace ProposalTypes {
  export interface Struct {
    relays: RelayerTypes.ProtocolOptions[];
    proposer: {
      publicKey: string;
      metadata: ClientTypes.Metadata;
    };
    chains: SessionTypes.Chains;
    methods: SessionTypes.Methods;
    events: SessionTypes.Events;
    pairingTopic?: string;
    pairingRequestId?: number;
  }
}

export type IProposal = IStore<ProposalTypes.Struct>;
