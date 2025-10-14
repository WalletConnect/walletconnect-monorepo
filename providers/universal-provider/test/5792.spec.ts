import { expect, describe, it, beforeAll } from "vitest";

import UniversalProvider, { SendCallsResult } from "../src";
import {
  ACCOUNTS,
  CHAIN_ID_B,
  EIP155_TEST_METHODS,
  TEST_PROVIDER_OPTS,
  TEST_WALLET_CLIENT_OPTS,
} from "./shared/constants";
import { WalletClient } from "./shared/WalletClient";
import { formatJsonRpcResult } from "@walletconnect/jsonrpc-utils";
import { getStoredSendCalls } from "../src/utils";
import { deleteProviders, testConnectMethod } from "./shared";
const events = ["chainChanged"];
const CHAIN_ID = 1;
describe("UniversalProvider 5792 utils", function () {
  let provider: UniversalProvider;
  let walletClient: WalletClient;
  let walletAddress: string;
  let receiverAddress: string;
  beforeAll(async () => {
    provider = await UniversalProvider.init(TEST_PROVIDER_OPTS);

    walletClient = await WalletClient.init(provider, {
      ...TEST_WALLET_CLIENT_OPTS,
      chainId: CHAIN_ID,
    });

    await provider.connect({
      namespaces: {
        eip155: {
          methods: [...EIP155_TEST_METHODS, "wallet_getCallsStatus", "wallet_sendCalls"],
          chains: [`eip155:${CHAIN_ID}`, `eip155:${CHAIN_ID_B}`],
          events: ["chainChanged", "accountsChanged"],
        },
      },
    });

    walletAddress = walletClient.signer.address;
    receiverAddress = ACCOUNTS.b.address;
    expect(walletAddress).to.eql(ACCOUNTS.a.address);
    const providerAccounts = await provider.enable();
    expect(providerAccounts).to.eql([walletAddress]);
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
  });

  it("should store send calls result", async function () {
    const sendCallsRequest = [
      {
        version: "2.0.0",
        from: walletAddress,
        chainId: "0x01",
        atomicRequired: true,
        calls: [
          {
            to: receiverAddress,
            value: "0x9184e72a",
            data: "0xd46e8dd67c5d32be8d46e8dd67c5d32be8058bb8eb970870f072445675058bb8eb970870f072445675",
          },
          {
            to: receiverAddress,
            value: "0x182183",
            data: "0xfbadbaf01",
          },
        ],
        capabilities: {
          paymasterService: {
            url: "https://...",
            optional: true,
          },
        },
      },
    ];

    const sendCallsResult = await Promise.all([
      new Promise<void>((resolve) => {
        walletClient.client?.once("session_request", async (payload) => {
          await walletClient.client?.respond({
            topic: payload.topic,
            response: formatJsonRpcResult(payload.id, {
              id: "123",
              capabilities: {
                caip345: {
                  caip2: `eip155:${CHAIN_ID}`,
                  transactionHashes: [
                    "0xa52498b3b9a951859235ebaedfc92bcdb4f4b895b6467d71cbd7d65abf64ec41",
                  ],
                },
              },
            }),
          });
          resolve();
        });
      }),
      provider.request(
        {
          method: "wallet_sendCalls",
          params: sendCallsRequest,
        },
        `eip155:${CHAIN_ID}`,
      ),
    ]).then((results) => results[1] as SendCallsResult);

    expect(sendCallsResult).to.exist;
    expect(sendCallsResult.id).to.exist;
    expect(sendCallsResult.capabilities).to.exist;
    expect(sendCallsResult.capabilities.caip345).to.exist;
    expect(sendCallsResult.capabilities.caip345.caip2).to.eql(`eip155:${CHAIN_ID}`);
    expect(sendCallsResult.capabilities.caip345.transactionHashes).to.exist;

    const storedResult = await getStoredSendCalls({
      resultId: sendCallsResult.id,
      storage: provider.rpcProviders.eip155.storage,
    });

    expect(storedResult?.request).to.deep.equal(sendCallsRequest[0]);
    expect(storedResult?.result).to.deep.equal(sendCallsResult);
  });

  it("should get call status", async function () {
    const callStatus = await provider.request(
      {
        method: "wallet_getCallsStatus",
        params: ["123"],
      },
      `eip155:${CHAIN_ID}`,
    );

    expect(callStatus).to.exist;
    expect(callStatus).to.deep.equal({
      id: "123",
      version: "2.0.0",
      atomic: true,
      chainId: "0x01",
      capabilities: {
        caip345: {
          caip2: "eip155:1",
          transactionHashes: ["0xa52498b3b9a951859235ebaedfc92bcdb4f4b895b6467d71cbd7d65abf64ec41"],
        },
      },
      receipts: [
        {
          // random receipt from the explorer
          blockHash: "0x2ae77979eecb4655a3adc36e465c0b6aad2bb468426d7f76a0b415e20fcda685",
          blockNumber: "0x15ec918",
          contractAddress: null,
          cumulativeGasUsed: "0x12c9118",
          effectiveGasPrice: "0xf27bc1a4",
          from: "0xe2dd0c718513369148691d3cd7197ee03f4a8291",
          gasUsed: "0xb88e",
          logs: [
            {
              address: "0xb8cf3bc88f84a2723c12182e87b5c769a1b6f607",
              topics: [
                "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925",
                "0x000000000000000000000000e2dd0c718513369148691d3cd7197ee03f4a8291",
                "0x00000000000000000000000080a64c6d7f12c47b7c66c5b4e20e72bc1fcd5d9e",
              ],
              data: "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
              blockNumber: "0x15ec918",
              blockTimestamp: "0x68822a17",
              transactionHash: "0xa52498b3b9a951859235ebaedfc92bcdb4f4b895b6467d71cbd7d65abf64ec41",
              transactionIndex: "0xcd",
              blockHash: "0x2ae77979eecb4655a3adc36e465c0b6aad2bb468426d7f76a0b415e20fcda685",
              logIndex: "0x274",
              removed: false,
            },
          ],
          logsBloom:
            "0x00000000000000000001200000000000800000000000000000000000000000000000000000000000000000000000000000000000000000000000000400200000000000000000000000000000000000000000000100000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000008000000000000000000800000000000000000000000000000000000000000000000000000000000000000000000050000000000000000000000000000000000000000000000000000000000000",
          status: "0x1",
          to: "0xb8cf3bc88f84a2723c12182e87b5c769a1b6f607",
          transactionHash: "0xa52498b3b9a951859235ebaedfc92bcdb4f4b895b6467d71cbd7d65abf64ec41",
          transactionIndex: "0xcd",
          type: "0x2",
        },
      ],
      status: 200,
    });
  });
  it("should cache `wallet_getCapabilities` request with different chainIds", async () => {
    const dapp = await UniversalProvider.init({
      ...TEST_PROVIDER_OPTS,
      name: "dapp",
    });
    const wallet = await UniversalProvider.init({
      ...TEST_PROVIDER_OPTS,
      name: "wallet",
    });
    const chains = ["eip155:1"];
    const { sessionA } = await testConnectMethod(
      {
        dapp,
        wallet,
      },
      {
        requiredNamespaces: {
          eip155: {
            methods: ["wallet_getCapabilities"],
            events,
            chains,
          },
        },
        namespaces: {
          eip155: {
            accounts: chains.map((chain) => `${chain}:${walletAddress}`),
            methods: ["wallet_getCapabilities"],
            events,
          },
        },
      },
    );
    expect(sessionA).to.be.an("object");
    expect(sessionA.sessionProperties).to.be.undefined;
    const sessionPropertiesResponse = {
      "0x2105": {
        atomicBatch: {
          supported: true,
        },
      },
    };
    await Promise.all([
      new Promise<void>((resolve) => {
        wallet.client.once("session_request", async (event) => {
          await wallet.client.respond({
            topic: event.topic,
            response: formatJsonRpcResult(event.id, sessionPropertiesResponse),
          });
          resolve();
        });
      }),
      new Promise<void>(async (resolve) => {
        const result = await dapp.request({
          method: "wallet_getCapabilities",
          params: [walletAddress],
        });
        expect(result).to.eql(sessionPropertiesResponse);
        resolve();
      }),
    ]);
    // now the sessionProperties should be cached
    const updatedSession = dapp.client.session.get(sessionA.topic);
    expect(updatedSession.sessionProperties).to.exist;
    expect(updatedSession.sessionProperties?.capabilities).to.exist;

    const cachedResult = await dapp.request({
      method: "wallet_getCapabilities",
      params: [walletAddress],
    });
    expect(cachedResult).to.eql(sessionPropertiesResponse);

    const secondCapabilitiesResult = {
      "0x1": {
        atomicBatch: {
          supported: true,
        },
      },
    };

    await Promise.all([
      new Promise<void>((resolve) => {
        wallet.client.once("session_request", async (event) => {
          await wallet.client.respond({
            topic: event.topic,
            response: formatJsonRpcResult(event.id, secondCapabilitiesResult),
          });
          resolve();
        });
      }),
      new Promise<void>(async (resolve) => {
        const result = await dapp.request({
          method: "wallet_getCapabilities",
          // this req has additional chainId param so it should not use cached result but make a new request to the wallet
          params: [walletAddress, ["0x1"]],
        });
        expect(result).to.eql(secondCapabilitiesResult);
        resolve();
      }),
    ]);

    const updatedSession2 = dapp.client.session.get(sessionA.topic);
    expect(updatedSession2.sessionProperties).to.exist;
    expect(updatedSession2.sessionProperties?.capabilities).to.exist;
    expect(Object.keys(updatedSession2.sessionProperties?.capabilities || {}).length).to.eql(2);
    expect(updatedSession2.sessionProperties?.capabilities[`${walletAddress}0x1`]).to.eql(
      secondCapabilitiesResult,
    );

    await deleteProviders({ A: dapp, B: wallet });
  });

  it("should get `wallet_getCapabilities` from scoped properties", async () => {
    const dapp = await UniversalProvider.init({
      ...TEST_PROVIDER_OPTS,
      name: "dapp",
    });
    const wallet = await UniversalProvider.init({
      ...TEST_PROVIDER_OPTS,
      name: "wallet",
    });
    const chains = ["eip155:1"];
    // should handle both string and object values
    const scopedProperties = {
      "eip155:1": {
        [`eip155:1:${walletAddress}`]: {
          atomic: JSON.stringify({
            status: "supported",
          }),
          auxiliaryFunds: JSON.stringify({
            supported: false,
          }),
          "flow-control": {
            loose: ["halt", "continue"],
            strict: ["continue"],
          },
        },
      },
    };
    const { sessionA } = await testConnectMethod(
      {
        dapp,
        wallet,
      },
      {
        requiredNamespaces: {
          eip155: {
            methods: ["wallet_getCapabilities"],
            events,
            chains,
          },
        },
        namespaces: {
          eip155: {
            accounts: chains.map((chain) => `${chain}:${walletAddress}`),
            methods: ["wallet_getCapabilities"],
            events,
          },
        },
        scopedProperties,
      },
    );
    expect(sessionA).to.be.an("object");
    expect(sessionA.scopedProperties).to.exist;
    expect(sessionA.scopedProperties).to.eql(scopedProperties);

    const result = await dapp.request({
      method: "wallet_getCapabilities",
      params: [walletAddress, ["0x1"]],
    });

    expect(result).to.eql({
      "0x1": {
        atomic: {
          status: "supported",
        },
        auxiliaryFunds: {
          supported: false,
        },
        "flow-control": {
          loose: ["halt", "continue"],
          strict: ["continue"],
        },
      },
    });
    await deleteProviders({ A: dapp, B: wallet });
  });
  it("should get `wallet_getCapabilities` from sessionProperties", async () => {
    const dapp = await UniversalProvider.init({
      ...TEST_PROVIDER_OPTS,
      name: "dapp",
    });
    const wallet = await UniversalProvider.init({
      ...TEST_PROVIDER_OPTS,
      name: "wallet",
    });
    const chains = ["eip155:1"];

    // should handle both string and object values
    const sessionProperties = {
      atomic: JSON.stringify({
        status: "supported",
      }),
      auxiliaryFunds: JSON.stringify({
        supported: false,
      }),
      "flow-control": {
        loose: ["halt", "continue"],
        strict: ["continue"],
      },
    } as Record<string, any>;

    const { sessionA } = await testConnectMethod(
      {
        dapp,
        wallet,
      },
      {
        requiredNamespaces: {
          eip155: {
            methods: ["wallet_getCapabilities"],
            events,
            chains,
          },
        },
        namespaces: {
          eip155: {
            accounts: chains.map((chain) => `${chain}:${walletAddress}`),
            methods: ["wallet_getCapabilities"],
            events,
          },
        },
        sessionProperties,
      },
    );
    expect(sessionA).to.be.an("object");
    expect(sessionA.sessionProperties).to.exist;
    expect(sessionA.sessionProperties).to.eql(sessionProperties);

    const result = await dapp.request({
      method: "wallet_getCapabilities",
      params: [walletAddress, ["0x1"]],
    });

    expect(result).to.eql({
      "0x1": {
        atomic: {
          status: "supported",
        },
        auxiliaryFunds: {
          supported: false,
        },
        "flow-control": {
          loose: ["halt", "continue"],
          strict: ["continue"],
        },
      },
    });
    await deleteProviders({ A: dapp, B: wallet });
  });
});
