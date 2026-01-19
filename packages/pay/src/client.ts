/**
 * WalletConnect Pay Client
 *
 * TypeScript wrapper around the Pay provider for payment processing.
 */

import { getDefaultLoggerOptions, pino } from "@walletconnect/logger";
import type { Logger } from "@walletconnect/logger";
import { getAppId } from "@walletconnect/utils";

import { PAY_API_BASE_URL, SDK_NAME, SDK_VERSION, LOGGER_CONTEXT } from "./constants/index.js";
import { getSdkPlatform } from "./utils/index.js";
import type {
  WalletConnectPayOptions,
  PaymentOptionsResponse,
  ConfirmPaymentResponse,
  Action,
  PayProvider,
  PayProviderConfig,
  GetPaymentOptionsParams,
  GetRequiredPaymentActionsParams,
  ConfirmPaymentParams,
} from "./types/index.js";
import {
  PayError,
  PaymentOptionsError,
  PaymentActionsError,
  ConfirmPaymentError,
} from "./types/index.js";
import { createProvider, isProviderAvailable } from "./providers/index.js";

export class WalletConnectPay {
  public readonly projectId: string;
  public readonly apiKey: string;
  public readonly baseUrl: string;

  private readonly logger: Logger;
  private readonly provider: PayProvider;

  /**
   * Initialize a new Pay client
   * @param opts - Client options
   */
  constructor(opts: WalletConnectPayOptions) {
    this.projectId = opts.projectId;
    this.apiKey = opts.apiKey;
    this.baseUrl = opts.baseUrl ?? PAY_API_BASE_URL;

    // Initialize logger
    this.logger =
      typeof opts.logger === "string"
        ? pino(getDefaultLoggerOptions({ level: opts.logger }))
        : (opts.logger ?? pino(getDefaultLoggerOptions({ level: "error" })));

    this.logger.trace(`${LOGGER_CONTEXT} initialized`);

    // Build provider config
    const providerConfig: PayProviderConfig = {
      baseUrl: this.baseUrl,
      projectId: this.projectId,
      apiKey: this.apiKey,
      sdkName: SDK_NAME,
      sdkVersion: SDK_VERSION,
      sdkPlatform: getSdkPlatform(),
      bundleId: getAppId() ?? "",
    };

    // Create provider (auto-detects available provider)
    this.provider = createProvider(providerConfig);
    this.logger.debug(`${LOGGER_CONTEXT} provider initialized`);
  }

  /**
   * Check if the Pay SDK is available on this platform
   */
  static isAvailable(): boolean {
    return isProviderAvailable();
  }

  /**
   * Get payment options for a payment link
   *
   * @param params - Payment options parameters
   * @param params.paymentLink - Payment link or payment ID
   * @param params.accounts - List of CAIP-10 account addresses
   * @param params.includePaymentInfo - Whether to include payment info in response
   * @returns Payment options response
   * @throws PaymentOptionsError if the request fails
   */
  async getPaymentOptions(params: GetPaymentOptionsParams): Promise<PaymentOptionsResponse> {
    this.logger.debug(
      {
        paymentLink: params.paymentLink,
        accounts: params.accounts,
        includePaymentInfo: params.includePaymentInfo,
      },
      `${LOGGER_CONTEXT} getPaymentOptions`,
    );

    try {
      const response = await this.provider.getPaymentOptions(params);

      this.logger.debug(
        { paymentId: response.paymentId, optionsCount: response.options.length },
        `${LOGGER_CONTEXT} getPaymentOptions response`,
      );

      return response;
    } catch (error) {
      this.logger.error({ error }, `${LOGGER_CONTEXT} getPaymentOptions error`);
      throw error instanceof PayError ? error : new PaymentOptionsError(String(error));
    }
  }

  /**
   * Get required payment actions for a selected option
   *
   * @param params - Required actions parameters
   * @param params.paymentId - Payment ID
   * @param params.optionId - Selected option ID
   * @returns Array of actions to be signed
   * @throws PaymentActionsError if the request fails
   */
  async getRequiredPaymentActions(params: GetRequiredPaymentActionsParams): Promise<Action[]> {
    this.logger.debug(
      { paymentId: params.paymentId, optionId: params.optionId },
      `${LOGGER_CONTEXT} getRequiredPaymentActions`,
    );

    try {
      const actions = await this.provider.getRequiredPaymentActions(params);

      this.logger.debug(
        { actionsCount: actions.length },
        `${LOGGER_CONTEXT} getRequiredPaymentActions response`,
      );

      return actions;
    } catch (error) {
      this.logger.error({ error }, `${LOGGER_CONTEXT} getRequiredPaymentActions error`);
      throw error instanceof PayError ? error : new PaymentActionsError(String(error));
    }
  }

  /**
   * Confirm a payment with wallet signatures
   *
   * @param params - Confirm payment parameters
   * @param params.paymentId - Payment ID
   * @param params.optionId - Selected option ID
   * @param params.signatures - Array of signatures from wallet RPC calls
   * @param params.collectedData - Optional collected data fields
   * @returns Confirm payment response with final status
   * @throws ConfirmPaymentError if the request fails
   */
  async confirmPayment(params: ConfirmPaymentParams): Promise<ConfirmPaymentResponse> {
    this.logger.debug(
      {
        paymentId: params.paymentId,
        optionId: params.optionId,
        signaturesCount: params.signatures.length,
        hasCollectedData: !!params.collectedData,
      },
      `${LOGGER_CONTEXT} confirmPayment`,
    );

    try {
      const response = await this.provider.confirmPayment(params);

      this.logger.debug(
        { status: response.status, isFinal: response.isFinal },
        `${LOGGER_CONTEXT} confirmPayment response`,
      );

      return response;
    } catch (error) {
      this.logger.error({ error }, `${LOGGER_CONTEXT} confirmPayment error`);
      throw error instanceof PayError ? error : new ConfirmPaymentError(String(error));
    }
  }
}
