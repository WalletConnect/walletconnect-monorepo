export interface ICallTxData {
  type?: string;
  to?: string;
  value?: number | string;
  gas?: number | string;
  gasLimit?: number | string;
  gasPrice?: number | string;
  nonce?: number | string;
  data?: string;
}

export interface ITxData extends ICallTxData {
  from: string;
}
