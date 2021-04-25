import "mocha";
import EthereumProvider from "./../src/index";
import { TestNetwork } from "ethereum-test-network";
import { expect } from "chai";

const CHAIN_ID = 123;
const PORT = 8545;
const RPC_URL = `http://localhost:${PORT}`;
const DEFAULT_GENESIS_ACCOUNTS = [
  {
    balance: "0x295BE96E64066972000000",
    privateKey: "0xa3dac6ca0b1c61f5f0a0b3a0acf93c9a52fd94e8e33d243d3b3a8b8c5dc37f0b", // 0xaaE062157B53077da1414ec3579b4CBdF7a4116f
  },
];

describe("@walletconnect/ethereum-provider", () => {
  let testnetwork: TestNetwork;

  before(async () => {
    testnetwork = await TestNetwork.init({
      chainId: CHAIN_ID,
      port: PORT,
      genesisAccounts: DEFAULT_GENESIS_ACCOUNTS,
    });
  });

  after(async () => {
    await testnetwork.close();
  });

  it("needs tests", async () => {
    // needs tests
    const provider = new EthereumProvider({
      rpc: {
        custom: {
          [CHAIN_ID]: RPC_URL,
        },
      },
      chainId: CHAIN_ID,
    });
    // await provider.connect();
    // console.log(provider.accounts);
    expect(provider.chainId === CHAIN_ID, "chainId set");
  });
});
