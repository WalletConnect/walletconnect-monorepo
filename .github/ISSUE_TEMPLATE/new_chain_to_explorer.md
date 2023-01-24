---
name: Add a Chain
about: Get your chain added to Explorer
title: ""
labels: "type: new chain request"
assignees: ""
---

**Adding a new chain to the Explorer**
To get a new chain added to the Explorer, you will need to submit the following:

1. JSON-RPC spec for Wallets **(only if [one](https://docs.walletconnect.com/2.0/advanced/rpc-reference/ethereum-rpc) doesn't already exist)**. For more information, please review the Ethereum [JSON-RPC API docs](https://ethereum.org/en/developers/docs/apis/json-rpc/).
   **GitHub Link**:
2. Write a [CASA namespace spec](https://github.com/ChainAgnostic/namespaces) if not already available for this namespace.
   **GitHub Link**:
3. **namespaces**:
   _\*known chain namespaces (e.g. eip:155 for Ethereum/EVM-based chains, solana, ...)_
4. **chains**:
   _\*known chains, where the primary key is a compound key composed of namespace + reference (e.g. ETH mainnet is eip155:1)._
   _Please provide labels for each chain (e.g. mainnet, testnet, devnet, ...)_
5. **RPC endpoints**
   _\*list of common/canonical RPC endpoints for the chain(s)_
6. **[SLIP-0044](https://github.com/satoshilabs/slips/blob/master/slip-0044.md) coin type**:
   _\* slip44 coin type used in the namespace_

**Additional context**
Add any other context here.
