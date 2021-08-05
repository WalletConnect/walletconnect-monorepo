import * as encoding from "@walletconnect/encoding";

import { apiGetAccountNonce, apiGetGasPrices } from "./api";
import { toWad } from "./utilities";

export async function getGasPrice(chainId: string): Promise<string> {
  if (chainId === "eip155:1") return toWad("20", 9).toHexString();
  const gasPrices = await apiGetGasPrices();
  return toWad(`${gasPrices.slow.price}`, 9).toHexString();
}

export async function formatTestTransaction(account: string) {
  const [namespace, reference, address] = account.split(":");
  const chainId = `${namespace}:${reference}`;
  // nonce
  const _nonce = await apiGetAccountNonce(address, chainId);

  const nonce = encoding.sanitizeHex(encoding.numberToHex(_nonce));

  // gasPrice
  const _gasPrice = await getGasPrice(chainId);
  const gasPrice = encoding.sanitizeHex(_gasPrice);

  // gasLimit
  const _gasLimit = 21000;
  const gasLimit = encoding.sanitizeHex(encoding.numberToHex(_gasLimit));

  // value
  const _value = 0;
  const value = encoding.sanitizeHex(encoding.numberToHex(_value));

  const tx = { from: address, to: address, data: "0x", nonce, gasPrice, gasLimit, value };

  return tx;
}
