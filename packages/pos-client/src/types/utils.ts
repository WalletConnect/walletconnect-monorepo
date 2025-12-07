import { POSClientTypes } from "./index.js";

/** Helpers types for internal usage only */
export declare namespace UtilsTypes {
  type SupportedNamespace = {
    assetNamespaces: string[];
    capabilities: any;
    events: any[];
    methods: string[];
    name: string;
  };

  type SupportedNamespaces = SupportedNamespace[];

  type isValidTokenParams = {
    token: POSClientTypes.Token;
    supportedNamespaces: SupportedNamespaces;
  };

  type isValidPaymentIntentParams = {
    paymentIntent: POSClientTypes.PaymentIntent;
    supportedNamespaces: SupportedNamespaces;
  };
}
