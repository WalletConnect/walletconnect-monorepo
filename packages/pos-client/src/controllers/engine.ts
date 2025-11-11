import { SignClient } from "@walletconnect/sign-client";
import { ISignClient, ProposalTypes } from "@walletconnect/types";
import { payloadId } from "@walletconnect/jsonrpc-utils";
import { parseChainId } from "@walletconnect/utils";
import { Logger, pino } from "@walletconnect/logger";

import {
  IPOSClientEngine,
  POSClientEngineTypes,
  POSClientTypes,
  UtilsTypes,
} from "../types/index.js";
import { isValidPaymentIntent, isValidToken } from "../utils/index.js";
import {
  CLIENT_STORAGE_OPTIONS,
  MAX_TRANSACTION_STATUS_CHECKS,
  DEFAULT_NAMESPACES,
  RPC_URL,
  RPC_ERROR_CODES,
  DEFAULT_LOGGER_LEVEL,
  CLIENT_STORAGE_PREFIX,
} from "../constants/index.js";

export class Engine extends IPOSClientEngine {
  public signClient: ISignClient;
  public logger: Logger;
  public tokens: POSClientTypes.Token[] = [];
  public supportedNamespaces: UtilsTypes.SupportedNamespaces = DEFAULT_NAMESPACES;

  // map to keep track of pending payment intents
  // private paymentIntentsMap: Map<number, POSClientTypes.PaymentIntent[]> = new Map();
  public paymentIntents?: POSClientTypes.PaymentIntent[];

  // transactions to be submitted to the wallet
  public transactions?: POSClientEngineTypes.Transaction[];

  private paymentsSendingInProgress = false;
  private manualControl = false;

  constructor(client: IPOSClientEngine["client"]) {
    super(client);
    // initialized in init()
    this.signClient = {} as any;
    this.logger = pino({
      name: this.client.name,
      level: this.client.opts.loggerOptions?.posLevel || DEFAULT_LOGGER_LEVEL,
    });
  }

  public init = async () => {
    this.setupEventHandlers();

    this.signClient = await SignClient.init({
      projectId: this.client.opts.projectId,
      metadata: {
        name: this.client.metadata.merchantName,
        description: this.client.metadata.description,
        url: this.client.metadata.url,
        icons: [this.client.metadata.logoIcon],
      },
      storageOptions: {
        database: this.client.opts.storageOptions?.databaseName || CLIENT_STORAGE_OPTIONS.database,
      },
      customStoragePrefix: CLIENT_STORAGE_OPTIONS.customStoragePrefix,
      logger: this.client.opts.loggerOptions?.signLevel || DEFAULT_LOGGER_LEVEL,
    });

    this.fetchSupportedNamespacesInBackground();
  };

  /**
   * Fetches supported namespaces in the background without blocking initialization.
   */
  private async fetchSupportedNamespacesInBackground() {
    this.logger.debug("Fetching supported namespaces/networks in background");

    const persistedSessionTopic = await this.getPersistedSessionTopic();
    if (persistedSessionTopic) {
      try {
        this.client.session = this.signClient.session.get(persistedSessionTopic);
      } catch (error) {
        this.logger.error(error, "Failed to get persisted session topic");
      }
    }

    try {
      this.logger.debug("Fetching supported namespaces/networks");
      const supportedNamespaces =
        await this.fetchRpcRequest<POSClientEngineTypes.RPCSupportedNetworksResult>(
          JSON.stringify({
            id: payloadId(),
            jsonrpc: "2.0",
            method: "wc_pos_supportedNetworks",
            params: {},
          }),
        );
      this.logger.debug(
        {
          supportedNamespaces: supportedNamespaces.result.namespaces,
        },
        "Received supported namespaces/networks",
      );
      this.supportedNamespaces = supportedNamespaces.result.namespaces;
    } catch (error) {
      this.logger.error(error, "Failed to fetch supported namespaces/networks");
    }
  }

  public setTokens: IPOSClientEngine["setTokens"] = async (params) => {
    const { tokens } = params;
    this.logger.debug({ tokens }, "Setting tokens");
    tokens.forEach((token) => {
      if (!isValidToken({ token, supportedNamespaces: this.supportedNamespaces })) {
        throw new Error(`Invalid token: ${JSON.stringify(token)}`);
      }
    });
    await new Promise<void>((resolve) => {
      this.tokens = tokens;
      resolve();
    });

    this.logger.debug({ tokens }, "Tokens set");
  };

  public createPaymentIntent: IPOSClientEngine["createPaymentIntent"] = async (params) => {
    const { paymentIntents, manualControl } = params;
    this.logger.debug({ paymentIntents }, "Creating payment intent");

    if (paymentIntents.length === 0) {
      throw new Error("No payment intents provided");
    }

    this.manualControl = manualControl || false;

    for (const paymentIntent of paymentIntents) {
      if (!isValidPaymentIntent({ paymentIntent, supportedNamespaces: this.supportedNamespaces })) {
        throw new Error(`Invalid payment intent: ${JSON.stringify(paymentIntent)}`);
      }
    }
    this.logger.debug({ paymentIntents }, "Payment intent validation success");

    this.paymentIntents = paymentIntents;
    this.logger.debug({ paymentIntents }, "Payment intents set");

    if (this.client.session) {
      try {
        this.validateApprovedNamespacesWithPaymentIntents();

        if (!this.manualControl) {
          await this.sendPaymentsToWallet();
        }
        return;
      } catch (error) {
        this.logger.error(error);
        await this.disconnect();
      }
    }

    const namespaces = this.composeNamespaces(paymentIntents);
    const { uri, approval } = await this.signClient.connect({
      optionalNamespaces: namespaces,
    });
    this.logger.debug({ uri }, "Connected to the WalletConnect network");
    if (!uri) {
      this.client.events.emit("connection_failed", {
        error: {
          message: "Failed to connect to the WalletConnect network",
          code: 4001,
        },
      });
      throw new Error("Failed to connect to the WalletConnect network");
    }
    this.emit("await_approval", { approval });
    this.logger.debug("Emitted await_approval event");
    this.emit("qr_ready", { uri });
    this.logger.debug({ uri }, "Emitted qr_ready event");
    if (this.manualControl) {
      const session = await approval();
      await this.onSessionConnected({ session });
    }
  };

  public restart: IPOSClientEngine["restart"] = async (params) => {
    this.logger.debug({ params }, "Restarting");
    const manualControl = this.manualControl;
    if (params?.reinit) {
      this.tokens = [];
      this.cleanup();
      await this.disconnect();
      this.logger.debug("Restarted: Cleared payment intents, transactions and disconnected");
      return;
    }
    // restart the payment intent flow from the beginning
    const paymentIntents = this.paymentIntents;
    if (!paymentIntents) {
      throw new Error("No payment intents found");
    }
    await this.createPaymentIntent({ paymentIntents, manualControl });
    this.logger.debug(
      { paymentIntents },
      "Restarted: Created payment intent flow from the beginning",
    );
  };

  // ---------- Event Handlers ----------------------------------------------- //

  public emit: IPOSClientEngine["emit"] = (event, args) => {
    this.logger.debug({ event, args }, "Emit");
    return this.client.events.emit(event, args);
  };

  public on: IPOSClientEngine["on"] = (event, listener) => {
    this.logger.debug({ event, listener }, "On");
    return this.client.events.on(event, listener);
  };

  public once: IPOSClientEngine["once"] = (event, listener) => {
    this.logger.debug({ event, listener }, "Once");
    return this.client.events.once(event, listener);
  };

  public off: IPOSClientEngine["off"] = (event, listener) => {
    this.logger.debug({ event, listener }, "Off");
    return this.client.events.off(event, listener);
  };

  public removeListener: IPOSClientEngine["removeListener"] = (event, listener) => {
    this.logger.debug({ event, listener }, "Remove listener");
    return this.client.events.removeListener(event, listener);
  };

  // ---------- Private ----------------------------------------------- //

  private composeNamespaces(
    paymentIntents: POSClientTypes.PaymentIntent[],
  ): ProposalTypes.OptionalNamespaces {
    this.logger.debug({ paymentIntents }, "Composing namespaces");
    const namespaces: ProposalTypes.OptionalNamespaces = {};
    paymentIntents.forEach((paymentIntent) => {
      const {
        token: { network },
      } = paymentIntent;
      const { namespace } = parseChainId(network.chainId);
      const namespaceDetails = this.supportedNamespaces.find((ns) => ns.name === namespace);
      if (!namespaceDetails) {
        throw new Error(`Namespace not supported: ${namespace}`);
      }

      namespaces[namespace] = {
        methods: namespaceDetails.methods,
        chains: [...(namespaces[namespace]?.chains || []), network.chainId],
        events: namespaceDetails.events,
      };
    });
    this.logger.debug({ namespaces }, "Composed namespaces");
    return namespaces;
  }

  prepareTransactionsFromPaymentIntents: IPOSClientEngine["prepareTransactionsFromPaymentIntents"] =
    async () => {
      const paymentIntents = this.paymentIntents;
      if (!paymentIntents) {
        throw new Error("No payment intents found");
      }
      const session = this.client.session;
      if (!session) {
        throw new Error("No session found");
      }

      this.logger.debug(
        {
          sessionTopic: session.topic,
        },
        "Preparing transactions from payment intents",
      );
      const intents: POSClientEngineTypes.RPCPaymentIntent[] = [];
      for (const paymentIntent of paymentIntents) {
        const { token, amount, recipient } = paymentIntent;
        const { namespace } = parseChainId(token.network.chainId);
        // gets the first address that matches the token network chain id
        const account = session.namespaces?.[namespace]?.accounts?.find((account) =>
          account.includes(`${token.network.chainId}:`),
        );
        if (!account) {
          throw new Error(
            `Address not found in session for chain id: ${
              token.network.chainId
            }, approved addresses: ${session.namespaces?.[namespace]?.accounts?.join(", ")}`,
          );
        }

        intents.push({
          asset: `${token.network.chainId}/${token.standard.toLowerCase()}:${token.address}`,
          recipient,
          amount,
          sender: account,
        });
      }

      this.logger.debug(
        {
          sessionTopic: session.topic,
          transactions: intents,
        },
        "Prepared transactions from payment intents",
      );

      const payload = {
        id: payloadId(),
        jsonrpc: "2.0",
        method: "wc_pos_buildTransactions",
        params: {
          paymentIntents: intents,
        },
      };

      this.logger.debug({ payload }, "Fetching wc_pos_buildTransactions");
      const response = await this.fetchRpcRequest<POSClientEngineTypes.RPCTransactions>(
        JSON.stringify(payload),
      );
      this.logger.debug({ response }, "Received wc_pos_buildTransactions");
      this.transactions = response.result.transactions;

      this.logger.debug(
        {
          transactions: this.transactions,
        },
        "Payment intent to transactions map set",
      );
    };

  sendPaymentsToWallet: IPOSClientEngine["sendPaymentsToWallet"] = async () => {
    if (this.paymentsSendingInProgress) {
      throw new Error("Payments are already being sent, please wait for them to complete");
    }
    this.paymentsSendingInProgress = true;

    try {
      await this.prepareTransactionsFromPaymentIntents();
      this.sendTransactionsToWallet();
    } catch (error) {
      this.logger.error(error, "Error while sending payments to wallet");
    }
    this.paymentsSendingInProgress = false;
  };

  sendTransactionsToWallet: IPOSClientEngine["sendTransactionsToWallet"] = async () => {
    const transactions = this.transactions;
    const paymentIntents = this.paymentIntents;
    if (!transactions || !paymentIntents) {
      throw new Error(
        "No transactions or payment intents to send, call createPaymentIntent() first",
      );
    }
    const session = this.client.session;
    if (!session) {
      throw new Error("No session found");
    }
    this.logger.debug(
      {
        transactions,
        sessionTopic: this.client.session?.topic,
      },
      "Sending transactions to wallet",
    );

    for (let i = 0; i < transactions.length; i++) {
      const transaction = transactions[i];
      const paymentIntent = paymentIntents[i];
      try {
        this.emit("payment_requested", { paymentIntent, transaction });
        this.logger.debug(
          {
            transactionId: transaction.id,
          },
          "Emitted payment_requested event",
        );

        let result;
        try {
          result = await this.signClient.request({
            topic: session.topic,
            request: {
              method: transaction.method,
              params: transaction.params,
            },
            chainId: transaction.chainId,
          });
          this.logger.debug(
            {
              transactionId: transaction.id,
              result,
            },
            "Wallet responded to payment request",
          );
        } catch (error) {
          this.logger.error(error, "Error while sending payment request");
          this.emit("payment_rejected", {
            error: {
              message: (error as Error)?.message,
              code: 4001,
            },
            paymentIntent,
          });
          throw error;
        }
        this.emit("payment_broadcasted", { paymentIntent, transaction, result });
        this.logger.debug(
          {
            transactionId: transaction.id,
          },
          "Emitted payment_broadcasted event",
        );
        await this.awaitPaymentConfirmed({ transaction, result });
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        this.logger.error(error, "Error while awaiting payment confirmed");
      }
    }
    this.cleanup();
    if (!this.manualControl) {
      await this.disconnect();
    }
  };

  awaitPaymentConfirmed: IPOSClientEngine["awaitPaymentConfirmed"] = async (params) => {
    try {
      const { transaction, result } = params;
      this.logger.debug({ transactionId: transaction.id, result }, "Awaiting payment confirmed");
      const payload = {
        id: payloadId(),
        jsonrpc: "2.0",
        method: "wc_pos_checkTransaction",
        params: {
          id: transaction.id,
          sendResult: typeof result === "string" ? result : JSON.stringify(result),
        },
      };

      let numCheckAttempts = 0;
      let transactionResult;
      while (!transactionResult) {
        if (numCheckAttempts >= MAX_TRANSACTION_STATUS_CHECKS) {
          throw new Error(`Transaction status not found for id: ${transaction.id}`);
        }
        numCheckAttempts++;

        const response = await this.fetchRpcRequest<POSClientEngineTypes.RPCCheckTransactionResult>(
          JSON.stringify(payload),
        );
        this.logger.debug(
          {
            transactionId: transaction.id,
            response,
          },
          "Received wc_pos_checkTransaction",
        );
        if (response.result.status === "CONFIRMED") {
          this.logger.debug({ response }, "Transaction status confirmed");
          this.emit("payment_successful", {
            transaction,
            result,
          });
          transactionResult = response.result;
          break;
        } else if (response.result.status === "FAILED") {
          this.logger.debug({ response }, "Transaction failed");
          this.emit("payment_failed", {
            error: {
              message: response.result.error,
              code: 4001,
            },
            transaction: result,
          });
          transactionResult = response.result;
          break;
        } else if (response.result.status === "PENDING") {
          this.logger.debug({ response }, "Transaction pending");
          await new Promise((resolve) => setTimeout(resolve, response.result.checkIn || 1000));
        }
      }
    } catch (error) {
      this.logger.error(error, "Error while awaiting payment confirmations");
    }
  };

  private setupEventHandlers = () => {
    this.on("await_approval", async ({ approval }) => {
      try {
        this.logger.debug("On await_approval");
        const session = await approval();
        await this.onSessionConnected({ session });
      } catch (error) {
        this.logger.error(error, "Error while awaiting approval");
        this.emit("connection_rejected", {
          error: {
            message: (error as Error)?.message,
            code: 4001,
          },
        });
      }
    });
  };

  onSessionConnected: IPOSClientEngine["onSessionConnected"] = async (params) => {
    const { session } = params;
    this.logger.debug({ sessionTopic: session.topic }, "On session connected");
    // disable deep links for the session
    await this.signClient.session.update(session.topic, {
      sessionConfig: {
        disableDeepLink: true,
      },
    });
    this.logger.debug({ sessionTopic: session.topic }, "Disabled deep links for session");

    this.client.session = this.signClient.session.get(session.topic);
    await this.persistSessionTopic(session.topic);
    this.emit("connected", { session });
    this.logger.debug("Emitted connected event");

    if (!this.manualControl) {
      await this.sendPaymentsToWallet();
    }
  };

  disconnect: IPOSClientEngine["disconnect"] = async () => {
    if (this.client.session) {
      await this.clearPersistedSessionTopic();
      await this.signClient.disconnect({
        topic: this.client.session.topic,
        reason: { code: 4001, message: "User disconnected" },
      });
    }

    this.manualControl = false;
    this.client.session = undefined;
  };

  private fetchRpcRequest = async <T>(payload: string): Promise<T> => {
    this.logger.debug({ url: this.getRpcUrl(), payload }, "Fetching RPC request");
    const result = await fetch(this.getRpcUrl(), {
      method: "POST",
      body: payload,
    });

    let data;
    try {
      data = await result.json();
    } catch (error) {
      this.logger.error(error, "Error while getting json data from RPC response");
    }

    this.logger.debug({ data }, "Received RPC request response");

    if (!result.ok || data.error) {
      const code = data.error?.code || -18900;
      const message = RPC_ERROR_CODES?.[code]
        ? `${RPC_ERROR_CODES?.[code]}: ${data.error?.message}`
        : data.error?.message;
      this.emit("payment_failed", {
        error: {
          message,
          code,
        },
        transaction: "",
      });
      throw new Error(message);
    }
    return data as T;
  };

  // validates that the approved namespaces contain at least one address that matches the payment intent
  private validateApprovedNamespacesWithPaymentIntents = () => {
    const session = this.client.session;
    const paymentIntents = this.paymentIntents;
    if (!session || !paymentIntents) {
      throw new Error("No session or payment intents found");
    }

    const matchedAddresses: string[] = [];
    for (const paymentIntent of paymentIntents) {
      const { token } = paymentIntent;
      const { namespace } = parseChainId(token.network.chainId);
      // gets the first address that matches the token network chain id
      const account = session.namespaces?.[namespace]?.accounts?.find((account) =>
        account.includes(`${token.network.chainId}:`),
      );
      if (!account) {
        continue;
      }
      matchedAddresses.push(account);
    }

    if (matchedAddresses.length === 0) {
      throw new Error("No approved addresses satisfying the proposed payment intents");
    }
  };

  private cleanup = () => {
    this.paymentIntents = undefined;
    this.transactions = undefined;
    this.logger.debug("Cleaned up payment intents and transactions");
  };

  private getRpcUrl = () => {
    return RPC_URL({ projectId: this.client.opts.projectId });
  };

  private persistSessionTopic = async (topic: string) => {
    await this.signClient.core.storage.setItem(this.getStoragePrefix() + "sessionTopic", topic);
  };

  private getPersistedSessionTopic = async () => {
    return await this.signClient.core.storage.getItem(this.getStoragePrefix() + "sessionTopic");
  };

  private clearPersistedSessionTopic = async () => {
    await this.signClient.core.storage.removeItem(this.getStoragePrefix() + "sessionTopic");
  };

  private getStoragePrefix = () => {
    return CLIENT_STORAGE_PREFIX;
  };
}
