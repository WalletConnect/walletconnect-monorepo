import { IProvider } from "../types";
import { HttpProvider } from "../utils/httpProvider";

export class SolaxyProvider implements IProvider {
  namespace = "solaxy";
  httpProvider: HttpProvider;

  constructor(rpcUrl?: string) {
    this.httpProvider = new HttpProvider(
      rpcUrl || "https://mainnet.rpc.solaxy.io"
    );
  }

  async request(args: { method: string; params?: any[] }) {
    // Pass standard JSON-RPC requests to Solaxy node
    return await this.httpProvider.request(args);
  }

  getDefaultChain() {
    return "solaxy:1936682104";
  }

  getMethods() {
    // supported methods can mirror Solana JSON RPC
    return [
      "getAccountInfo",
      "getBalance",
      "getBlockHeight",
      "getTransaction",
      "sendTransaction",
      "getSignaturesForAddress",
      "getRecentBlockhash",
    ];
  }
}

export default SolaxyProvider;
