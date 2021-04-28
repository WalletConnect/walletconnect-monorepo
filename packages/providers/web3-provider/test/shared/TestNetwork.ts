import { HardhatNetworkFakeModuleLogger } from "./utils/HardhatNetworkFakeModuleLogger";
import { HardhatNetworkProvider } from "hardhat/internal/hardhat-network/provider/provider";
import { BackwardsCompatibilityProviderAdapter } from "hardhat/internal/core/providers/backwards-compatibility";
import { JsonRpcServer } from "hardhat/internal/hardhat-network/jsonrpc/server";
import { GenesisAccount } from "hardhat/internal/hardhat-network/provider/node-types";
import { ethers } from "ethers";

const DEFAULT_CHAIN_ID = 123;
const DEFAULT_NETWORK_ID = 234;
const DEFAULT_GENESIS_ACCOUNTS = [
  {
    balance: ethers.utils.parseEther("1000000000000").toHexString(),
    privateKey: "0xa3dac6ca0b1c61f5f0a0b3a0acf93c9a52fd94e8e33d243d3b3a8b8c5dc37f0b", // 0xaaE062157B53077da1414ec3579b4CBdF7a4116f
  },
  {
    balance: ethers.utils.parseEther("1000000000000").toHexString(),
    privateKey: "0xfc6e27fbc1cc2eb3f04dab6259d926280d4aa8acb8c83f3de506ab9d589d6cc2", // 0xbbDBFf23Df1e064f458aCd943E48179bD3271fA0
  },
  {
    balance: ethers.utils.parseEther("1000000000000").toHexString(),
    privateKey: "0x735e4ab2cd08798dee1a5fc3a7af4bbdeece90c7dbdf878ceec556c84bd5ec88", // 0xcc5a0dc5152D368D55A10f68f874A05A4dd65bee
  },
];
const DEFAULT_JSON_RPC_PORT = 8545;
const DEFAULT_BLOCK_GAS_LIMIT = 8000000;

interface TestNetworkInitParams {
  jsonRPC: boolean;
  port: number;
  chainId: number;
  networkId: number;
  genesisAccounts: GenesisAccount[];
  blockGasLimit: number;
}
export class TestNetwork {
  provider: BackwardsCompatibilityProviderAdapter;
  server?: JsonRpcServer;

  constructor(params: { provider: BackwardsCompatibilityProviderAdapter; server?: JsonRpcServer }) {
    this.provider = params.provider;
    this.server = params.server;
  }

  static async init(_params: Partial<TestNetworkInitParams> = {}) {
    const params: TestNetworkInitParams = {
      jsonRPC: true,
      genesisAccounts: DEFAULT_GENESIS_ACCOUNTS,
      chainId: DEFAULT_CHAIN_ID,
      networkId: DEFAULT_NETWORK_ID,
      port: DEFAULT_JSON_RPC_PORT,
      blockGasLimit: DEFAULT_BLOCK_GAS_LIMIT,
      ..._params,
    };
    const logger = new HardhatNetworkFakeModuleLogger(true);
    const hardhatNetwork = new HardhatNetworkProvider(
      "istanbul",
      "WalletConnectTest",
      params.chainId,
      params.networkId,
      params.blockGasLimit,
      true,
      true,
      true,
      0,
      logger,
      DEFAULT_GENESIS_ACCOUNTS,
      undefined,
      true,
      undefined,
      undefined,
      undefined,
    );
    let provider = new BackwardsCompatibilityProviderAdapter(hardhatNetwork);
    let server;
    if (params.jsonRPC) {
      server = new JsonRpcServer({
        hostname: "localhost",
        port: params.port,
        provider: provider,
      });
      await server.listen();
      provider = new BackwardsCompatibilityProviderAdapter(server.getProvider());
    }
    return new TestNetwork({ provider: provider, server: server });
  }
  async close() {
    if (this.server) {
      await this.server.close();
      delete this.server;
    }
    delete (this as any).provider;
  }
}
