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
  PaymentStatus,
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
  account: string;
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
 * Raw API response for status/confirm
 */
interface RawStatusResponse {
  status: string;
  isFinal: boolean;
  pollInMs?: number;
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
      "Sdk-Name": config.sdkName,
      "Sdk-Version": config.sdkVersion,
      "Sdk-Platform": config.sdkPlatform,
      ...this.buildAuthHeader(config),
    };
  }

  /**
   * Build authentication header based on config
   */
  private buildAuthHeader(config: PayProviderConfig): Record<string, string> {
    if (config.apiKey) {
      return { "Api-Key": config.apiKey };
    }
    if (config.appId) {
      return { "App-Id": config.appId };
    }
    return {};
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
   * Safely decode a URI component, returning the original string on failure
   */
  private safeDecodeUri(value: string): string {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  /**
   * Extract a parameter value from a query string
   */
  private extractQueryParam(query: string, paramName: string): string | null {
    const prefix = `${paramName}=`;
    for (const param of query.split("&")) {
      if (param.startsWith(prefix)) {
        const value = param.slice(prefix.length);
        if (value.length > 0) return value;
      }
    }
    return null;
  }

  /**
   * Extract payment ID from a link's query string or path
   */
  private extractPidFromLink(link: string): string | null {
    const queryStart = link.indexOf("?");

    if (queryStart !== -1) {
      const query = link.slice(queryStart + 1);
      const pidFromQuery = this.extractQueryParam(query, "pid");
      if (pidFromQuery) return pidFromQuery;
    }

    const lastSlash = link.lastIndexOf("/");
    const lastSegment = lastSlash !== -1 ? link.slice(lastSlash + 1) : link;
    const cleanSegment = lastSegment.split("?")[0];

    if (cleanSegment.length > 0 && !cleanSegment.includes("%")) {
      return cleanSegment;
    }

    return null;
  }

  /**
   * Try to extract payment ID from a wc: URI
   */
  private tryExtractFromWcUri(uri: string): string | null {
    const queryStart = uri.indexOf("?");
    if (queryStart === -1) return null;

    const query = uri.slice(queryStart + 1);
    const payParam = this.extractQueryParam(query, "pay");
    if (!payParam) return null;

    const payLink = this.safeDecodeUri(payParam);
    return this.extractPidFromLink(payLink);
  }

  /**
   * Extract payment ID from a payment link
   */
  private extractPaymentId(paymentLink: string): string {
    const decoded = this.safeDecodeUri(paymentLink);

    // Check for wc: URI (both decoded and original)
    if (decoded.startsWith("wc:")) {
      const id = this.tryExtractFromWcUri(decoded);
      if (id) return id;
    }

    if (paymentLink.startsWith("wc:")) {
      const id = this.tryExtractFromWcUri(paymentLink);
      if (id) return id;
    }

    // Try to extract from decoded link first, then original
    const decodedId = this.extractPidFromLink(decoded);
    if (decodedId) return decodedId;

    const originalId = this.extractPidFromLink(paymentLink);
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
      account: raw.account,
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
   * Check if action is a walletRpc action (type guard)
   */
  private isWalletRpcAction(
    action: RawAction,
  ): action is RawAction & { type: "walletRpc"; data: RawWalletRpcAction } {
    return action.type === "walletRpc";
  }

  /**
   * Check if action is a build action (type guard)
   */
  private isBuildAction(
    action: RawAction,
  ): action is RawAction & { type: "build"; data: { data: string } } {
    return action.type === "build";
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
      if (this.isWalletRpcAction(action)) {
        resolved.push(this.transformAction(action.data));
      } else if (this.isBuildAction(action)) {
        const fetched = await this.fetch(paymentId, optionId, action.data.data);
        for (const fetchedAction of fetched) {
          if (this.isWalletRpcAction(fetchedAction)) {
            resolved.push(this.transformAction(fetchedAction.data));
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
      info: this.transformPaymentInfo(response.info),
      options: response.options.map((o) => this.transformPaymentOption(o)),
      collectData: this.transformCollectData(response.collectData),
    };
  }

  /**
   * Transform raw payment info to SDK format
   */
  private transformPaymentInfo(
    info: RawPaymentOptionsResponse["info"],
  ): PaymentOptionsResponse["info"] {
    if (!info) return undefined;

    return {
      status: info.status as PaymentStatus,
      amount: info.amount,
      expiresAt: info.expiresAt,
      merchant: info.merchant,
      buyer: info.buyer
        ? {
            accountCaip10: info.buyer.accountCaip10,
            accountProviderName: info.buyer.accountProviderName,
            accountProviderIcon: info.buyer.accountProviderIcon,
          }
        : undefined,
    };
  }

  /**
   * Transform raw collect data to SDK format
   */
  private transformCollectData(
    collectData: RawPaymentOptionsResponse["collectData"],
  ): PaymentOptionsResponse["collectData"] {
    if (!collectData) return undefined;

    return {
      fields: collectData.fields.map((f) => ({
        id: f.id,
        name: f.name,
        required: f.required,
        fieldType: f.type,
      })),
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
    const response = await this.request<RawStatusResponse>(
      "POST",
      `/v1/gateway/payment/${params.paymentId}/confirm`,
      {
        optionId: params.optionId,
        results: params.signatures.map((sig) => ({ type: "walletRpc", data: [sig] })),
        collectedData: params.collectedData
          ? { fields: params.collectedData.map((f) => ({ id: f.id, value: f.value })) }
          : undefined,
      },
    );

    let result = this.toConfirmPaymentResponse(response);

    while (!result.isFinal) {
      const delay = result.pollInMs ?? 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));

      const statusResponse = await this.request<RawStatusResponse>(
        "GET",
        `/v1/gateway/payment/${params.paymentId}/status`,
      );

      result = this.toConfirmPaymentResponse(statusResponse);
    }

    return result;
  }

  /**
   * Convert raw status response to ConfirmPaymentResponse
   */
  private toConfirmPaymentResponse(raw: RawStatusResponse): ConfirmPaymentResponse {
    return {
      status: raw.status as PaymentStatus,
      isFinal: raw.isFinal,
      pollInMs: raw.pollInMs,
    };
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
