import { Core } from "@walletconnect/core";
import { IWalletKit, WalletKit } from "@reown/walletkit";
import { IWalletKitWdkAdapter, WalletKitWdkAdapterTypes } from "./types/index.js";

export class WalletKitWdkAdapter implements IWalletKitWdkAdapter {
  public walletKit: IWalletKit;

  static async init(opts: WalletKitWdkAdapterTypes.Options): Promise<IWalletKit> {
    const adapter = new WalletKitWdkAdapter(opts);
    return await adapter.initialize();
  }

  constructor(public opts: WalletKitWdkAdapterTypes.Options) {
    // initialized during init
    this.walletKit = {} as IWalletKit;
  }

  public async initialize(): Promise<IWalletKit> {
    const core = new Core({
      projectId: this.opts.projectId,
    });
    this.walletKit = await WalletKit.init({
      core,
      ...this.opts,
    });
    return this.walletKit;
  }
}
