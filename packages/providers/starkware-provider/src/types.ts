export interface ETHTokenData {
  quantum: string;
}

export interface ERC20TokenData {
  quantum: string;
  tokenAddress: string;
}

export interface ERC721TokenData {
  tokenId: string;
  tokenAddress: string;
}

export type TokenTypes = "ETH" | "ERC20" | "ERC721";

export type TokenData = ETHTokenData | ERC20TokenData | ERC721TokenData;

export interface Token {
  type: TokenTypes;
  data: TokenData;
}

export interface TransferParams {
  starkPublicKey: string;
  vaultId: string;
}

export interface OrderParams {
  vaultId: string;
  token: Token;
  quantizedAmount: string;
}
