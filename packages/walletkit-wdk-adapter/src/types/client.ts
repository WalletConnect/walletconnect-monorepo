import { IWalletKit, WalletKitTypes } from "@reown/walletkit";

export namespace WalletKitWdkAdapterTypes {
  export type Options = Omit<WalletKitTypes.Options, "core"> & {
    projectId: string;
  };
}
export interface IWalletKitWdkAdapter {
  initialize(): Promise<IWalletKit>;
}
