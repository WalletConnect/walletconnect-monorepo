import { ChainData, ChainsMap, TezosMethod } from "../types";
import { TezosOperationType } from "@airgap/beacon-types";

export const DefaultTezosMethods: TezosMethod[] = [
  TezosMethod.GET_ACCOUNTS,
  TezosMethod.SIGN,
  TezosMethod.SEND
];

export const RelayUrl: string =  "wss://relay.walletconnect.org";

export const TezosChainDataMainnet: ChainData = {
  name: "Tezos",
  id: "tezos:mainnet",
  rpc: ["https://rpc.tzbeta.net"],
  api: "https://api.tzkt.io/v1",
  testnet: false,
}

export const TezosChainDataTestnet: ChainData =   {
  name: "Tezos Testnet",
  id: "tezos:testnet",
  rpc: ["https://rpc.ghostnet.teztnets.com"],
  api: "https://api.ghostnet.tzkt.io/v1",
  testnet: true,
}

export const TezosChainMap: ChainsMap = {
  "tezos:mainnet": TezosChainDataMainnet,
  "tezos:testnet": TezosChainDataTestnet,
};

// These operations are not needed for the wallet.
// Double pre-attestation and double pre-endorsement are specific to the accuser.
// Other operations are baker specific.
export const UnsupportedOperations: TezosOperationType[] = [
  TezosOperationType.ATTESTATION,
  TezosOperationType.ATTESTATION_WITH_SLOT,
  TezosOperationType.DOUBLE_ATTESTATION_EVIDENCE,
  TezosOperationType.DOUBLE_BAKING_EVIDENCE,
  TezosOperationType.DOUBLE_PREATTESTATION_EVIDENCE,
  TezosOperationType.DOUBLE_PREENDORSEMENT_EVIDENCE,
  TezosOperationType.DRAIN_DELEGATE,
  TezosOperationType.ENDORSEMENT,
  TezosOperationType.ENDORSEMENT_WITH_SLOT,
  TezosOperationType.PREATTESTATION,
  TezosOperationType.SEED_NONCE_REVELATION,
  TezosOperationType.VDF_REVELATION,
];
