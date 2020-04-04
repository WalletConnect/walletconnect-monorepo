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

export interface Token {
  type: string;
  data: ETHTokenData | ERC20TokenData | ERC721TokenData;
}

export interface TransferParams {
  starkPublicKey: string;
  vaultID: string;
}

export interface OrderParams {
  vaultID: string;
  token: Token;
  quantizedAmount: string;
}
