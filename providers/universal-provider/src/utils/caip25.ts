import { SessionTypes } from "@walletconnect/types";
import { isValidObject } from "@walletconnect/utils";

import { isValidJSONObject } from "./misc.js";

const EIP155_PREFIX = "eip155";
const CAPABILITIES_KEYS = [
  "atomic",
  "flow-control",
  "paymasterService",
  "sessionKeys",
  "auxiliaryFunds",
];

const hexToDecimal = (hex?: string) => {
  // PATCH: Add type check before calling startsWith to prevent "startsWith is not a function" errors
  // Use explicit type guard that can't be optimized away by bundler
  if (hex == null) {
    return hex;
  }
  const hexType = typeof hex;
  if (hexType !== 'string') {
    // Return as string to ensure decimalToHex receives a string
    return String(hex);
  }
  // At this point we know hex is a string, safe to call startsWith
  return hex.startsWith("0x") ? BigInt(hex).toString(10) : hex;
};

const decimalToHex = (decimal: string) => {
  // PATCH: Add type check before calling startsWith to prevent "startsWith is not a function" errors
  // Use explicit type guard that can't be optimized away by bundler
  if (decimal == null) {
    return decimal;
  }
  const decimalType = typeof decimal;
  if (decimalType !== 'string') {
    return decimal;
  }
  // At this point we know decimal is a string, safe to call startsWith
  if (decimal.startsWith("0x")) {
    return decimal;
  }
  return `0x${BigInt(decimal).toString(16)}`;
};

const getCapabilitiesFromObject = (object: Record<string, any>) => {
  const capabilitiesKeys = Object.keys(object).filter((item) => CAPABILITIES_KEYS.includes(item));

  return capabilitiesKeys.reduce(
    (acc, key) => {
      acc[key] = parseCapabilityValue(object[key]);
      return acc;
    },
    {} as Record<string, any>,
  );
};

const parseCapabilityValue = (value: any) => {
  if (typeof value === "string" && isValidJSONObject(value)) {
    return JSON.parse(value);
  }
  return value;
};

export const extractCapabilitiesFromSession = (
  session: SessionTypes.Struct,
  address: string,
  chainIds: string[],
) => {
  const { sessionProperties = {}, scopedProperties = {} } = session;
  const result: Record<string, any> = {};

  if (!isValidObject(scopedProperties) && !isValidObject(sessionProperties)) {
    return;
  }

  // get all capabilities from sessionProperties as they apply to all chains/addresses
  const globalCapabilities = getCapabilitiesFromObject(sessionProperties);

  for (const chain of chainIds) {
    // PATCH: Ensure chain is a string before calling hexToDecimal
    const chainStr = typeof chain === 'string' ? chain : String(chain);
    const chainId = hexToDecimal(chainStr);
    if (!chainId) {
      continue;
    }

    // PATCH: Ensure chainId is a string before calling decimalToHex
    const chainIdStr = typeof chainId === 'string' ? chainId : String(chainId);
    result[decimalToHex(chainIdStr)] = globalCapabilities;

    const chainSpecific = scopedProperties?.[`${EIP155_PREFIX}:${chainId}`];

    if (chainSpecific) {
      const addressSpecific = chainSpecific?.[`${EIP155_PREFIX}:${chainId}:${address}`];

      // use the address specific capabilities if they exist, otherwise use the chain specific capabilities
      // PATCH: Ensure chainId is a string before calling decimalToHex
      const chainIdStr = typeof chainId === 'string' ? chainId : String(chainId);
      result[decimalToHex(chainIdStr)] = {
        ...result[decimalToHex(chainIdStr)],
        ...getCapabilitiesFromObject(addressSpecific || chainSpecific),
      };
    }
  }

  // remove any chains that have no capabilities
  for (const [key, value] of Object.entries(result)) {
    if (Object.keys(value).length === 0) {
      delete result[key];
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
};
