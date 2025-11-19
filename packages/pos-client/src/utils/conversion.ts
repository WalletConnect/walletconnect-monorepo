import { EngineTypes } from "@walletconnect/types";
import { POSClientTypes } from "../types/index.js";

export const toHex = (value: string): EngineTypes.Hex => {
  return `0x${BigInt(value).toString(16)}`;
};

export const fromHex = (value: EngineTypes.Hex): string => {
  return BigInt(value).toString();
};

export const formatAcceptedPaymentFromPaymentIntent = (
  paymentIntent: POSClientTypes.PaymentIntent,
): EngineTypes.PaymentOption => {
  return {
    asset: `${paymentIntent.token.network.chainId}/${paymentIntent.token.standard.toLowerCase()}:${paymentIntent.token.address}`,
    amount: toHex(paymentIntent.amount),
    recipient: paymentIntent.recipient,
  };
};
