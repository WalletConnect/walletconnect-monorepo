import { isValidChainId, parseChainId } from "@walletconnect/utils";
import { UtilsTypes } from "../types/index.js";

export const isValidToken = (params: UtilsTypes.isValidTokenParams) => {
  const { supportedNamespaces, token } = params;
  const { network, symbol, standard, address } = token;
  if (!network || !symbol || !standard || !address || !isValidChainId(network?.chainId)) {
    return false;
  }

  const { namespace } = parseChainId(network.chainId);
  const supportedNamespaceDetails = supportedNamespaces.find(
    (ns) => ns.name.toLowerCase() === namespace.toLowerCase(),
  );
  if (!supportedNamespaceDetails) {
    throw new Error(`Unsupported token namespace: ${namespace}`);
  }

  const supportedStandards = supportedNamespaceDetails.assetNamespaces.map((ns) =>
    ns.toLowerCase(),
  );

  if (!supportedStandards.includes(standard?.toLowerCase())) {
    throw new Error(`Unsupported token standard: ${standard} for namespace: ${namespace}`);
  }

  return true;
};

export const isValidPaymentIntent = (params: UtilsTypes.isValidPaymentIntentParams) => {
  const { supportedNamespaces, paymentIntent } = params;
  const { token, amount, recipient } = paymentIntent;
  if (!token || !amount || !recipient || !isValidToken({ supportedNamespaces, token })) {
    return false;
  }
  return true;
};
