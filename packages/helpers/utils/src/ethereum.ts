import { keccak_256 } from "js-sha3";

import { ITxData } from "@walletconnect/types";
import { convertUtf8ToHex, convertNumberToHex, convertUtf8ToBuffer } from "./encoding";
import { sanitizeHex, removeHexLeadingZeros } from "./misc";
import { isEmptyArray, isHexString, isEmptyString } from "./validators";
import { removeHexPrefix, addHexPrefix } from "enc-utils";

export function toChecksumAddress(address: string): string {
  address = removeHexPrefix(address);
  const hash = sanitizeHex(keccak_256(convertUtf8ToBuffer(address)));
  let checksum = "";
  for (let i = 0; i < address.length; i++) {
    if (parseInt(hash[i], 16) > 7) {
      checksum += address[i].toUpperCase();
    } else {
      checksum += address[i];
    }
  }
  return addHexPrefix(checksum);
}

export const isValidAddress = (address?: string) => {
  function isAddressAllLowercase(str: string) {
    return /^(0x)?[0-9a-f]{40}$/i.test(str);
  }
  if (!address) {
    return false;
  } else if (address.toLowerCase().substring(0, 2) !== "0x") {
    return false;
  } else if (!isAddressAllLowercase(address)) {
    return false;
  } else if (/^(0x)?[0-9a-f]{40}$/.test(address) || /^(0x)?[0-9A-F]{40}$/.test(address)) {
    return true;
  } else {
    return address === toChecksumAddress(address);
  }
};

export function parsePersonalSign(params: string[]): string[] {
  if (!isEmptyArray(params) && !isHexString(params[0])) {
    params[0] = convertUtf8ToHex(params[0]);
  }
  return params;
}

export function parseTransactionData(txData: Partial<ITxData>): Partial<ITxData> {
  if (typeof txData.from === "undefined" || !isValidAddress(txData.from)) {
    throw new Error(`Transaction object must include a valid 'from' value.`);
  }

  function parseHexValues(value: number | string) {
    let result = value;
    if (typeof value === "number" || (typeof value === "string" && !isEmptyString(value))) {
      if (!isHexString(value)) {
        result = convertNumberToHex(value);
      } else if (typeof value === "string") {
        result = sanitizeHex(value);
      }
    }
    if (typeof result === "string") {
      result = removeHexLeadingZeros(result);
    }
    return result;
  }

  const txDataRPC = {
    from: sanitizeHex(txData.from),
    to: typeof txData.to === "undefined" ? "" : sanitizeHex(txData.to),
    gasPrice: typeof txData.gasPrice === "undefined" ? "" : parseHexValues(txData.gasPrice),
    gas:
      typeof txData.gas === "undefined"
        ? typeof txData.gasLimit === "undefined"
          ? ""
          : parseHexValues(txData.gasLimit)
        : parseHexValues(txData.gas),
    value: typeof txData.value === "undefined" ? "" : parseHexValues(txData.value),
    nonce: typeof txData.nonce === "undefined" ? "" : parseHexValues(txData.nonce),
    data: typeof txData.data === "undefined" ? "" : sanitizeHex(txData.data) || "0x",
  };

  const prunable = ["gasPrice", "gas", "value", "nonce"];
  Object.keys(txDataRPC).forEach((key: string) => {
    if (!txDataRPC[key].trim().length && prunable.includes(key)) {
      delete txDataRPC[key];
    }
  });

  return txDataRPC;
}
