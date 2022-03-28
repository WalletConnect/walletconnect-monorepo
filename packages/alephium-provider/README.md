---
description: Alephium Wallet JSON-RPC Methods
---

# Alephium

All Alephium wallets should respond to the following JSON-RPC methods which are
received across the WalletConnect connection. There is no method to get
addresses because WalletConnect returns a set of addresses to use when a pairing
is successful or re-establishes. More methods may be added in the future.

## alephium_getServices

This method returns an object with various service URLs specified by the wallet,
such as a cryptocurrency node URL, and an explorer URL.

It is particularly useful as it'll provide dApps with a public cryptocurrency
node for which they can fetch blockchain information.

### Parameters

    none

### Returns

    1.`Object` - Object of services:
    	1.1. `nodeHost` : `STRING` - The URL to the cryptocurrency node to be used by the dApp
    	1.2. `explorerUrl` : `STRING` - The URL to a blockchain explorer
    	1.3. `explorerApiHost`: `STRING` - The URL to a blockchain explorer API to be used by the dApp

### Example

```javascript
// Request
{
  "id": 1,
  "jsonrpc": "2.0",
  "method": "alephium_getServices",
  "params": {}
}

// Result (These are just example URLs, they may not be valid in reality.)
{
  "id": 1,
  "jsonrpc": "2.0",
  "result":  [
      {
        "nodeHost": "https://testnet.alephium.org",
        "explorerUrl": "https://explorer.alephium.org",
        "explorerApiHost": "https://api.explorer.alephium.org",
      }
    ]
}
```

## alephium_signAndSubmitTx

This method returns transaction id for the provided transaction.

It will both sign and submit the transaction to the blockchain, rather than
return the result back to the dApp and have the dApp submit it.

In the future two new methods which separate these operations may exist - it'll
depend on the ecosystem.

The method applies to regular transactions, contract transactions and script
transactions. It will know what transaction it is based on the information
provided. This is why a lot of the below properties can be `undefined`.

If the `fromAddress` doesn't exist in the responding wallet, the dApp will be
notified via an `error` property in the response object.

### Parameters

    1. `Object` - Parameters:
    	1.1. `fromAddress` : `STRING` - corresponding address for keypair
    	1.2. `toAddress | UNDEFINED` : `STRING` - corresponding address for recipient
    	1.3. `amount | UNDEFINED` : `STRING` - ALPH amount in "set" to send (smallest denomination in ALPH)
    	1.4. `gasAmount | UNDEFINED` : `STRING` - Gas amount in "set" to send (smallest denomination in ALPH)
    	1.5. `script` : `STRING | UNDEFINED` - Script code which will be compiled
    	1.6. `contractCode` : `STRING | UNDEFINED` - Contract code which will be compiled
    	1.7. `contractState` : `STRING | UNDEFINED` - The initial state that the contractCode will use in JSON format
    	1.8. `issueTokenAmount` : `NUMBER | UNDEFINED` - The amount of a token to issue during contract creation 

### Returns

    1. `Object`
    	1.1. `txId` : `STRING` -  The transaction id
    	1.2. `contractAddress` : `STRING | UNDEFINED` - The contract address when a contract is created

### Examples

Here are some examples for each transaction type.

#### A regular transaction

```javascript
// Request
{
  "id": 1,
  "jsonrpc": "2.0",
  "method": "alephium_signAndSubmitTx",
  "params": {
		"fromAddress": "1IiXJwgCAjyn7jmsXwZBBQGJHbiAB2NZonirArnxrS5y6",
		"toAddress": "16iXJwgCBjYn6jmsXwAXXQGJHbiAA2NZonirA8nxYR7x5",
		"amount": "10000000000000"
	}
}

// Result
{
  "id": 1,
  "jsonrpc": "2.0",
  "result":  {
		"txId": "698ca2f58b1e0e751f4f57e95724e35fea691d88ea53a5d11aff112bdfb03215",
	}
}
```

#### A contract transaction

```javascript
// Request
{
  "id": 1,
  "jsonrpc": "2.0",
  "method": "alephium_signAndSubmitTx",
  "params": {
		"fromAddress": "1IiXJwgCAjyn7jmsXwZBBQGJHbiAB2NZonirArnxrS5y6",
		"toAddress": "16iXJwgCBjYn6jmsXwAXXQGJHbiAA2NZonirA8nxYR7x5",
		"amount": "10000000", // Requires the most minimal amount for a TX, "storage rent fee"
		"gasAmount": "80000000000000000", // Will usually be specified by the dApp
		"contractCode": "TxContract Voting(     title: ByteVec,     mut yes: U256,     mut no: U256,     mut isClosed: Bool,     mut initialized: Bool,     admin: Address,     voters: [Address; 1]   ) {     pub payable fn allocateTokens() -> () {        assert!(initialized == false)        assert!(txCaller!(txCallerSize!() - 1) == admin)        transferAlph!(admin, voters[0], 50000000000000)transferTokenFromSelf!(voters[0], selfTokenId!(), 1)        yes = 0        no = 0        initialized = true     }     pub payable fn vote(choice: Bool, voter: Address) -> () {       assert!(initialized == true && isClosed == false)       transferAlph!(voter, admin, 50000000000000)       transferTokenToSelf!(voter, selfTokenId!(), 1)       if (choice == true) {          yes = yes + 1       } else {          no = no + 1       }     }      pub fn close() -> () {        assert!(initialized == true && isClosed == false)        assert!(txCaller!(txCallerSize!() - 1) == admin)        isClosed = true      }    }",
		"contractState": "[{\"type\":\"ByteVec\",\"value\":\"546869732069732061207175657374696f6e207469746c65\"},{\"type\":\"U256\",\"value\":\"0\"},{\"type\":\"U256\",\"value\":\"0\"},{\"type\":\"Bool\",\"value\":false},{\"type\":\"Bool\",\"value\":false},{\"type\":\"Address\",\"value\":\"16eKJyuSKqSPLQwxqDdnGzSAmeFT3wDD9ihe66vZieXW6\"},{\"type\":\"Array\",\"value\":[{\"type\":\"Address\",\"value\":\"16eKJyuSKqSPLQwxqDdnGzSAmeFT3wDD9ihe66vZieXW6\"}]}]",
		"issueTokenAmount": "6" // 6 general tokens will be created in this contract
	}
}

// Result
{
  "id": 1,
  "jsonrpc": "2.0",
  "result":  {
		"txId": "698ca2f58b1e0e751f4f57e95724e35fea691d88ea53a5d11aff112bdfb03215",
		"contractAddress": "16iXJwgCBjYn6jmsXwAXXQGJHbiAA2NZonirA8nxYR7x5"
	}
}
```

#### A script transaction

```javascript
// Request
{
  "id": 1,
  "jsonrpc": "2.0",
  "method": "alephium_signAndSubmitTx",
  "params": {
		"fromAddress": "1IiXJwgCAjyn7jmsXwZBBQGJHbiAB2NZonirArnxrS5y6",
		"gasAmount": "80000000000000000", // Is required for script
		"script": "TxScript TokenAllocation {    pub payable fn main() -> () {      let voting = Voting(#9f8cf621c779fa3194027c346319d766e50fef9f0b92a4a57087163ba96c6cec)      let caller = txCaller!(0)      approveAlph!(caller, 50000000000000 * 1)      voting.allocateTokens()    }  }     TxContract Voting(     title: ByteVec,     mut yes: U256,     mut no: U256,     mut isClosed: Bool,     mut initialized: Bool,     admin: Address,     voters: [Address; 1]   ) {     pub payable fn allocateTokens() -> () {        assert!(initialized == false)        assert!(txCaller!(txCallerSize!() - 1) == admin)        transferAlph!(admin, voters[0], 50000000000000)transferTokenFromSelf!(voters[0], selfTokenId!(), 1)        yes = 0        no = 0        initialized = true     }     pub payable fn vote(choice: Bool, voter: Address) -> () {       assert!(initialized == true && isClosed == false)       transferAlph!(voter, admin, 50000000000000)       transferTokenToSelf!(voter, selfTokenId!(), 1)       if (choice == true) {          yes = yes + 1       } else {          no = no + 1       }     }      pub fn close() -> () {        assert!(initialized == true && isClosed == false)        assert!(txCaller!(txCallerSize!() - 1) == admin)        isClosed = true      }    }  "
	}
}

// Result
{
  "id": 1,
  "jsonrpc": "2.0",
  "result":  {
		"txId": "698ca2f58b1e0e751f4f57e95724e35fea691d88ea53a5d11aff112bdfb03215"
	}
}
```
