import { SessionTypes, AppMetadata } from "@walletconnect/types";

export const chainRef = 1;
export const chainId = `eip155:${chainRef}`;
export const method = "personal_sign";
export const params = ["0xdeadbeaf", "0x1d85568eEAbad713fBB5293B45ea066e552A90De"];
export const request = { method, params };
export const result =
  "0xa3f20717a250c2b0b729b7e5becbff67fdaef7e0699da4de7ca5895b02a170a12d887fd3b17bfdce3481f10bea41f45ba9f709d39ce8325427b57afcfc994cee1b";

export const permissions: SessionTypes.BasePermissions = {
  blockchain: {
    chains: [chainId],
  },
  jsonrpc: {
    methods: [method],
  },
};

export const metadata: AppMetadata = {
  name: "App Name",
  description: "Description of App",
  url: "https://walletconnect.org",
  icons: ["https://walletconnect.org/walletconnect-logo.png"],
};

export const address = "0x1d85568eEAbad713fBB5293B45ea066e552A90De";

export const state: SessionTypes.State = {
  accounts: [`${chainId}:${address}`],
};

export const connectorParams = {
  accounts: [address],
  chainId: chainRef,
};
