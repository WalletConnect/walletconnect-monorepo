import { fromHex } from "@cosmjs/encoding";
import { DirectSecp256k1Wallet } from "@cosmjs/proto-signing";
import { SignDoc } from "@cosmjs/proto-signing/build/codec/cosmos/tx/v1beta1/tx";

/**
 * Constants
 */
const DEFAULT_PREFIX = "cosmos";

/**
 * Library
 */
export default class CosmosLib {
  private directSigner: DirectSecp256k1Wallet;

  constructor(directSigner: DirectSecp256k1Wallet) {
    this.directSigner = directSigner;
  }

  static async init(privateKey: string) {
    const directSigner = await DirectSecp256k1Wallet.fromKey(fromHex(privateKey), DEFAULT_PREFIX);
    return new CosmosLib(directSigner);
  }

  public async getAddress() {
    const account = await this.directSigner.getAccounts();

    return account[0].address;
  }

  public async signDirect(address: string, signDoc: SignDoc) {
    return await this.directSigner.signDirect(address, signDoc);
  }
}
