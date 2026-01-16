/**
 * HTTP Provider for WalletConnect Pay SDK
 *
 * Uses direct HTTP calls to the Pay API for payment operations.
 * This provider works in any JavaScript environment with fetch support.
 */

import type {
  PaymentOptionsResponse,
  ConfirmPaymentResponse,
  Action,
  PayProvider,
  PayProviderConfig,
  GetPaymentOptionsParams,
  GetRequiredPaymentActionsParams,
  ConfirmPaymentParams,
  PaymentOption,
} from "../types/index.js";
import { PayError } from "../types/index.js";

/**
 * Raw API action type (before transformation)
 */
interface RawWalletRpcAction {
  chain_id: string;
  method: string;
  params: unknown[];
}

/**
 * Raw API action wrapper
 */
interface RawAction {
  type: "walletRpc" | "build";
  data: RawWalletRpcAction | { data: string };
}

/**
 * Raw API payment option
 */
interface RawPaymentOption {
  id: string;
  amount: {
    unit: string;
    value: string;
    display: {
      assetSymbol: string;
      assetName: string;
      decimals: number;
      iconUrl?: string;
      networkName?: string;
    };
  };
  etaS: number;
  actions: RawAction[];
}

/**
 * Raw API response for payment options
 */
interface RawPaymentOptionsResponse {
  options: RawPaymentOption[];
  info?: {
    status: string;
    amount: {
      unit: string;
      value: string;
      display: {
        assetSymbol: string;
        assetName: string;
        decimals: number;
        iconUrl?: string;
        networkName?: string;
      };
    };
    expiresAt: number;
    merchant: {
      name: string;
      iconUrl?: string;
    };
    buyer?: {
      accountCaip10: string;
      accountProviderName: string;
      accountProviderIcon?: string;
    };
  };
  collectData?: {
    fields: Array<{
      type: "text" | "date";
      id: string;
      name: string;
      required: boolean;
    }>;
  };
}

/**
 * Raw API response for fetch
 */
interface RawFetchResponse {
  actions: RawAction[];
}

/**
 * Cached payment option for resolving build actions
 */
interface CachedPaymentOption {
  optionId: string;
  actions: RawAction[];
}

/**
 * HTTP provider implementation using direct API calls
 */
export class HttpProvider implements PayProvider {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private cachedOptions: CachedPaymentOption[] = [];

  constructor(config: PayProviderConfig) {
    this.baseUrl = config.baseUrl;
    this.headers = {
      "Content-Type": "application/json",
      "Api-Key": config.apiKey,
      "Sdk-Name": config.sdkName,
      "Sdk-Version": config.sdkVersion,
      "Sdk-Platform": config.sdkPlatform,
    };
  }

  /**
   * Make an HTTP request to the API
   */
  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: this.headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new PayError(
        "UNKNOWN",
        `${response.status}: ${error.message || response.statusText}`,
        error.message,
      );
    }

    return response.json() as Promise<T>;
  }

  /**
   * Extract payment ID from a payment link
   */
  private extractPaymentId(paymentLink: string): string {
    const urlDecode = (s: string): string => {
      try {
        return decodeURIComponent(s);
      } catch {
        return s;
      }
    };

    const extractPidFromQuery = (query: string): string | null => {
      for (const param of query.split("&")) {
        if (param.startsWith("pid=")) {
          const id = param.slice(4);
          if (id.length > 0) return id;
        }
      }
      return null;
    };

    const extractPidFromLink = (link: string): string | null => {
      // Check for ?pid= query param
      const queryStart = link.indexOf("?");
      if (queryStart !== -1) {
        const query = link.slice(queryStart + 1);
        const id = extractPidFromQuery(query);
        if (id) return id;
      }

      // Try last path segment
      const lastSlash = link.lastIndexOf("/");
      const lastSegment = lastSlash !== -1 ? link.slice(lastSlash + 1) : link;
      const cleanSegment = lastSegment.split("?")[0];

      if (cleanSegment.length > 0 && !cleanSegment.includes("%")) {
        return cleanSegment;
      }

      return null;
    };

    const extractPayParamValue = (query: string): string | null => {
      for (const param of query.split("&")) {
        if (param.startsWith("pay=")) {
          return urlDecode(param.slice(4));
        }
      }
      return null;
    };

    const tryExtractFromWcUri = (uri: string): string | null => {
      const queryStart = uri.indexOf("?");
      if (queryStart === -1) return null;

      const query = uri.slice(queryStart + 1);
      const payLink = extractPayParamValue(query);
      if (!payLink) return null;

      return extractPidFromLink(payLink);
    };

    const decoded = urlDecode(paymentLink);

    // Check for wc: URI
    if (decoded.startsWith("wc:")) {
      const id = tryExtractFromWcUri(decoded);
      if (id) return id;
    }

    if (paymentLink.startsWith("wc:")) {
      const id = tryExtractFromWcUri(paymentLink);
      if (id) return id;
    }

    // Try to extract from decoded link
    const decodedId = extractPidFromLink(decoded);
    if (decodedId) return decodedId;

    // Try to extract from original link
    const originalId = extractPidFromLink(paymentLink);
    if (originalId) return originalId;

    throw new PayError(
      "PAYMENT_OPTIONS",
      `Invalid payment link format: '${paymentLink}'`,
      `unsupported payment link format: '${paymentLink}'`,
    );
  }

  /**
   * Transform raw API action to SDK action format
   */
  private transformAction(rawAction: RawWalletRpcAction): Action {
    return {
      walletRpc: {
        chainId: rawAction.chain_id,
        method: rawAction.method,
        params: JSON.stringify(rawAction.params),
      },
    };
  }

  /**
   * Transform raw payment option to SDK format (only walletRpc actions)
   */
  private transformPaymentOption(raw: RawPaymentOption): PaymentOption {
    return {
      id: raw.id,
      amount: raw.amount,
      etaS: raw.etaS,
      actions: raw.actions
        .filter(
          (a): a is RawAction & { type: "walletRpc"; data: RawWalletRpcAction } =>
            a.type === "walletRpc",
        )
        .map((a) => this.transformAction(a.data)),
    };
  }

  /**
   * Fetch/resolve build actions from the API
   */
  private async fetch(
    paymentId: string,
    optionId: string,
    data: string = "",
  ): Promise<RawAction[]> {
    const response = await this.request<RawFetchResponse>(
      "POST",
      `/v1/gateway/payment/${paymentId}/fetch`,
      { optionId, data },
    );
    return response.actions;
  }

  /**
   * Resolve all actions for an option (handles build actions)
   */
  private async resolveActions(
    paymentId: string,
    optionId: string,
    actions: RawAction[],
  ): Promise<Action[]> {
    const resolved: Action[] = [];

    for (const action of actions) {
      if (action.type === "walletRpc") {
        resolved.push(this.transformAction(action.data as RawWalletRpcAction));
      } else if (action.type === "build") {
        const buildData = (action.data as { data: string }).data;
        const fetched = await this.fetch(paymentId, optionId, buildData);
        for (const fetchedAction of fetched) {
          if (fetchedAction.type === "walletRpc") {
            resolved.push(this.transformAction(fetchedAction.data as RawWalletRpcAction));
          }
        }
      }
    }

    return resolved;
  }

  async getPaymentOptions(params: GetPaymentOptionsParams): Promise<PaymentOptionsResponse> {
    const paymentId = this.extractPaymentId(params.paymentLink);

    const query = params.includePaymentInfo ? "?includePaymentInfo=true" : "";
    const response = await this.request<RawPaymentOptionsResponse>(
      "POST",
      `/v1/gateway/payment/${paymentId}/options${query}`,
      { accounts: params.accounts },
    );

    // Cache the raw options for use by getRequiredPaymentActions
    this.cachedOptions = response.options.map((o) => ({
      optionId: o.id,
      actions: o.actions,
    }));

    return {
      paymentId,
      info: response.info
        ? {
            status: response.info.status as PaymentOptionsResponse["info"] extends {
              status: infer S;
            }
              ? S
              : never,
            amount: response.info.amount,
            expiresAt: response.info.expiresAt,
            merchant: response.info.merchant,
            buyer: response.info.buyer
              ? {
                  accountCaip10: response.info.buyer.accountCaip10,
                  accountProviderName: response.info.buyer.accountProviderName,
                  accountProviderIcon: response.info.buyer.accountProviderIcon,
                }
              : undefined,
          }
        : undefined,
      options: response.options.map((o) => this.transformPaymentOption(o)),
      collectData: response.collectData
        ? {
            fields: response.collectData.fields.map((f) => ({
              id: f.id,
              name: f.name,
              required: f.required,
              fieldType: f.type,
            })),
          }
        : undefined,
    };
  }

  async getRequiredPaymentActions(params: GetRequiredPaymentActionsParams): Promise<Action[]> {
    // Check cache first
    const cached = this.cachedOptions.find((o) => o.optionId === params.optionId);

    let rawActions: RawAction[];
    if (cached && cached.actions.length > 0) {
      rawActions = cached.actions;
    } else {
      // Fetch actions if not cached
      rawActions = await this.fetch(params.paymentId, params.optionId, "");

      // Update cache
      const existingIndex = this.cachedOptions.findIndex((o) => o.optionId === params.optionId);
      if (existingIndex >= 0) {
        this.cachedOptions[existingIndex].actions = rawActions;
      } else {
        this.cachedOptions.push({ optionId: params.optionId, actions: rawActions });
      }
    }

    return this.resolveActions(params.paymentId, params.optionId, rawActions);
  }

  async confirmPayment(params: ConfirmPaymentParams): Promise<ConfirmPaymentResponse> {
    const response = await this.request<{
      status: string;
      isFinal: boolean;
      pollInMs?: number;
    }>("POST", `/v1/gateway/payment/${params.paymentId}/confirm`, {
      optionId: params.optionId,
      results: params.signatures.map((sig) => ({ type: "walletRpc", data: [sig] })),
      collectedData: params.collectedData
        ? { fields: params.collectedData.map((f) => ({ id: f.id, value: f.value })) }
        : undefined,
    });

    // If not final, poll for status
    let result: ConfirmPaymentResponse = {
      status: response.status as ConfirmPaymentResponse["status"],
      isFinal: response.isFinal,
      pollInMs: response.pollInMs,
    };

    while (!result.isFinal) {
      const delay = result.pollInMs ?? 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));

      const statusResponse = await this.request<{
        status: string;
        isFinal: boolean;
        pollInMs?: number;
      }>("GET", `/v1/gateway/payment/${params.paymentId}/status`);

      result = {
        status: statusResponse.status as ConfirmPaymentResponse["status"],
        isFinal: statusResponse.isFinal,
        pollInMs: statusResponse.pollInMs,
      };
    }

    return result;
  }
}

/**
 * Check if HTTP provider is available (always true in environments with fetch)
 */
export function isHttpProviderAvailable(): boolean {
  return typeof fetch !== "undefined";
}

/**
 * Create an HTTP provider instance
 */
export function createHttpProvider(config: PayProviderConfig): PayProvider {
  return new HttpProvider(config);
}
