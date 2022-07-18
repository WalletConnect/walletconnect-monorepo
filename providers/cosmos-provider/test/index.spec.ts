// import "mocha";
// import { expect } from "chai";
// import {
//   CosmosWallet,
//   formatDirectSignDoc,
//   parseSignDocValues,
//   stringifyAccountDataValues,
//   stringifySignDocValues,
// } from "cosmos-wallet";
// import Long from "long";
// import { fromHex, toHex } from "@cosmjs/encoding";
// import { AccountData, coins, makeSignDoc, makeAuthInfoBytes } from "@cosmjs/proto-signing";
// import { SIGNER_EVENTS } from "@walletconnect/signer-connection";
// import { SignClient, SIGN_CLIENT_EVENTS } from "@walletconnect/sign-client";
// import { SessionTypes, SignClientTypes } from "@walletconnect/types";

// import CosmosProvider from "./../src/index";
// import {
//   formatJsonRpcError,
//   formatJsonRpcResult,
//   JsonRpcResponse,
// } from "@walletconnect/jsonrpc-utils";

// const NAMESPACE = "cosmos";
// const CHAIN_ID = "cosmoshub-4";
// const RPC_URL = `https://rpc.cosmos.network/`;

// export const TEST_COSMOS_INPUTS = {
//   direct: {
//     fee: coins(2000, "ucosm"),
//     pubkey: "AgSEjOuOr991QlHCORRmdE5ahVKeyBrmtgoYepCpQGOW",
//     gasLimit: 200000,
//     accountNumber: 1,
//     sequence: 1,
//     bodyBytes:
//       "0a90010a1c2f636f736d6f732e62616e6b2e763162657461312e4d736753656e6412700a2d636f736d6f7331706b707472653766646b6c366766727a6c65736a6a766878686c63337234676d6d6b38727336122d636f736d6f7331717970717870713971637273737a673270767871367273307a716733797963356c7a763778751a100a0575636f736d120731323334353637",
//     authInfoBytes:
//       "0a500a460a1f2f636f736d6f732e63727970746f2e736563703235366b312e5075624b657912230a21034f04181eeba35391b858633a765c4a0c189697b40d216354d50890d350c7029012040a020801180112130a0d0a0575636f736d12043230303010c09a0c",
//   },
//   amino: {
//     msgs: [],
//     fee: { amount: [], gas: "23" },
//     chain_id: "foochain",
//     memo: "hello, world",
//     account_number: "7",
//     sequence: "54",
//   },
// };

// export const TEST_COSMOS_KEYPAIR = {
//   publicKey: "0204848ceb8eafdf754251c2391466744e5a85529ec81ae6b60a187a90a9406396",
//   privateKey: "366cd8d38f760f970bdc70b18d19f40756b92beeebc84074ceea8e092d406666",
// };

// export const TEST_COSMOS_ADDRESS = "cosmos1sguafvgmel6f880ryvq8efh9522p8zvmrzlcrq";

// export const TEST_RELAY_URL = process.env.TEST_RELAY_URL
//   ? process.env.TEST_RELAY_URL
//   : "ws://0.0.0.0:5000";

// const TEST_JSONRPC_METHOD = "test_method";
// const TEST_JSONRPC_REQUEST = { method: TEST_JSONRPC_METHOD, params: [] };
// const TEST_JSONRPC_RESULT = "it worked";

// const TEST_CHAINS = [CHAIN_ID];
// const TEST_METHODS = [TEST_JSONRPC_METHOD];

// const TEST_APP_METADATA = {
//   name: "Test App",
//   description: "Test App for WalletConnect",
//   url: "https://walletconnect.com/",
//   icons: ["https://avatars.githubusercontent.com/u/37784886"],
// };

// const TEST_WALLET_METADATA = {
//   name: "Test Wallet",
//   description: "Test Wallet for WalletConnect",
//   url: "https://walletconnect.com/",
//   icons: ["https://avatars.githubusercontent.com/u/37784886"],
// };

// export const TEST_COSMOS_DIRECT_SIGNATURE =
//   "LVtl91xbrxCTR643RZMw08uHV3tR5aL46iMiVnAFdWVoaQJN/+jpbs6GPyOOBgZW6nWldiB/WxGmMMoEHoCudQ==";

// export const TEST_COSMOS_AMINO_SIGNATURE =
//   "AnTrXtS2lr9CBwhTpRa8ZlKcVR9PeIXGaTpvodyJU05QvRKVjIkQfOZl5JhdkfxCY+a6rhwCOYVcbKQTJlMw4w==";

// async function getAccounts(wallet: CosmosWallet) {
//   return (await wallet.getAccounts()).map(stringifyAccountDataValues);
// }

// async function signDirect(wallet: CosmosWallet, signerAddress: string, signDoc: any) {
//   const result = await wallet.signDirect(signerAddress, parseSignDocValues(signDoc));
//   return {
//     signed: stringifySignDocValues(result.signed),
//     signature: result.signature,
//   };
// }

// async function signAmino(wallet: CosmosWallet, signerAddress: string, signDoc: any) {
//   const result = await wallet.signAmino(signerAddress, signDoc);
//   return result;
// }

// describe("@walletconnect/cosmos-provider", () => {
//   it("Test connect and sign", async () => {
//     const wallet = await CosmosWallet.init(TEST_COSMOS_KEYPAIR.privateKey);
//     const walletClient = await SignClient.init({
//       relayUrl: TEST_RELAY_URL,
//       metadata: TEST_WALLET_METADATA,
//     });
//     const provider = new CosmosProvider({
//       chains: TEST_CHAINS,
//       rpcMap: {
//         [CHAIN_ID]: RPC_URL,
//       },
//       client: {
//         relayUrl: TEST_RELAY_URL,
//         metadata: TEST_APP_METADATA,
//       },
//     });

//     // auto-pair
//     provider.signer.connection.on(SIGNER_EVENTS.uri, ({ uri }) => walletClient.pair({ uri }));
//     // connect
//     let accounts: string[] = [];
//     await Promise.all([
//       new Promise<void>((resolve, reject) => {
//         walletClient.on(
//           SIGN_CLIENT_EVENTS.session.proposal,
//           async (proposal: SessionTypes.Proposal) => {
//             const response = {
//               state: { accounts: [`${NAMESPACE}:${CHAIN_ID}:${TEST_COSMOS_ADDRESS}`] },
//             };
//             await walletClient.approve({
//               proposal,
//               response,
//             });
//             resolve();
//           },
//         );
//       }),
//       new Promise<void>(async (resolve, reject) => {
//         await provider.connect();
//         accounts = provider.accounts;
//         resolve();
//       }),
//     ]);
//     expect(accounts[0]).to.eql(TEST_COSMOS_ADDRESS);

//     // auto-respond
//     walletClient.on(
//       "session_request",
//       async (requestEvent: SignClientTypes.EventArguments["session_request"]) => {
//         let response: JsonRpcResponse;
//         const { params, id } = requestEvent;
//         try {
//           let result: any;
//           switch (params.request.method) {
//             case "cosmos_getAccounts":
//               result = await getAccounts(wallet);
//               break;
//             case "cosmos_signDirect":
//               result = await signDirect(
//                 wallet,
//                 params.request.params.signerAddress,
//                 params.request.params.signDoc,
//               );
//               break;
//             case "cosmos_signAmino":
//               result = await signAmino(
//                 wallet,
//                 params.request.params.signerAddress,
//                 params.request.params.signDoc,
//               );
//               break;
//             default:
//               throw new Error("Unsupported method");
//           }
//           response = formatJsonRpcResult(id, result);
//         } catch (e) {
//           response = formatJsonRpcError(id, e.message);
//         }
//         await walletClient.respond({
//           topic: requestEvent.topic,
//           response,
//         });
//       },
//     );

//     // cosmos_getAccounts
//     const accountsResult = await provider.request({ method: "cosmos_getAccounts" });

//     expect(!!accountsResult).to.be.true;
//     expect((accountsResult as any)[0].pubkey).to.eql(TEST_COSMOS_KEYPAIR.publicKey);

//     // cosmos_signDirect
//     const { fee, pubkey, gasLimit, accountNumber, sequence, bodyBytes } = TEST_COSMOS_INPUTS.direct;
//     const signDoc = formatDirectSignDoc(
//       fee,
//       pubkey,
//       gasLimit,
//       accountNumber,
//       sequence,
//       bodyBytes,
//       CHAIN_ID,
//     );
//     const directResult = await provider.request({
//       method: "cosmos_signDirect",
//       params: { signerAddress: TEST_COSMOS_ADDRESS, signDoc: stringifySignDocValues(signDoc) },
//     });
//     expect(!!directResult).to.be.true;
//     expect((directResult as any).signature.signature).to.eql(TEST_COSMOS_DIRECT_SIGNATURE);

//     // cosmos_signAmino
//     const aminoResult = await provider.request({
//       method: "cosmos_signAmino",
//       params: { signerAddress: TEST_COSMOS_ADDRESS, signDoc: TEST_COSMOS_INPUTS.amino },
//     });

//     expect(!!aminoResult).to.be.true;
//     expect((aminoResult as any).signature.signature).to.eql(TEST_COSMOS_AMINO_SIGNATURE);
//   });
// });
