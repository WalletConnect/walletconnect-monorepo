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
import { createApprovalAwaiter, isValidPaymentIntent, isValidToken } from "../utils/index.js";
import {
  CLIENT_STORAGE_OPTIONS,
  MAX_TRANSACTION_STATUS_CHECKS,
  DEFAULT_NAMESPACES,
  RPC_URL,
  RPC_ERROR_CODES,
  DEFAULT_LOGGER_LEVEL,
} from "../constants/index.js";

export class Engine extends IPOSClientEngine {
  public signClient: ISignClient;
  public logger: Logger;
  public tokens: POSClientTypes.Token[] = [];
  public supportedNamespaces: UtilsTypes.SupportedNamespaces = DEFAULT_NAMESPACES;

  // map to keep track of pending payment intents
  // private paymentIntentsMap: Map<number, POSClientTypes.PaymentIntent[]> = new Map();
  public paymentIntents: IPOSClientEngine["paymentIntents"] = {};

  // transactions to be submitted to the wallet
  public transactions: IPOSClientEngine["transactions"] = {};

  private paymentsSendingInProgress: Record<string, boolean> = {};
  private manualControl: Record<string, boolean> = {};

  constructor(client: IPOSClientEngine["client"]) {
    super(client);
    // initialized in init()
    this.signClient = {} as any;
    this.logger = pino({
      name: this.client.name,
      level: this.client.opts.loggerOptions?.posLevel || DEFAULT_LOGGER_LEVEL,
    });
    this.setupEventHandlers();
  }

  public init = async () => {
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

    this.signClient.events.on("session_delete", ({ topic }) => {
      this.cleanup({ sessionTopic: topic });
      this.emit("disconnected", { sessionTopic: topic });
    });

    try {
      this.logger.debug("Fetching supported namespaces/networks");
      const supportedNamespaces =
        await this.fetchRpcRequest<POSClientEngineTypes.RPCSupportedNetworksResult>({
          payload: JSON.stringify({
            id: payloadId(),
            jsonrpc: "2.0",
            method: "wc_pos_supportedNetworks",
            params: {},
          }),
          userId: "",
        });
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
  };

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
    const { paymentIntents, sessionTopic, userId } = params;
    this.logger.debug({ paymentIntents, userId }, "Creating payment intent");
    const manualControl = params.manualControl || false;
    if (paymentIntents.length === 0) {
      throw new Error("No payment intents provided");
    }

    for (const paymentIntent of paymentIntents) {
      if (!isValidPaymentIntent({ paymentIntent, supportedNamespaces: this.supportedNamespaces })) {
        throw new Error(`Invalid payment intent: ${JSON.stringify(paymentIntent)}`);
      }
    }
    this.logger.debug({ paymentIntents, userId }, "Payment intent validation success");

    if (sessionTopic) {
      this.manualControl[sessionTopic] = manualControl;
      try {
        this.setPaymentIntents({ sessionTopic, paymentIntents, userId });
        this.validateApprovedNamespacesWithPaymentIntents(sessionTopic);

        if (!manualControl) {
          await this.sendPaymentsToWallet({ sessionTopic, userId });
        }
        return;
      } catch (error) {
        this.logger.error(error);
        await this.disconnect({ sessionTopic });
      }
    }

    const namespaces = this.composeNamespacesFromPaymentIntents(paymentIntents);
    const { uri, approval } = await this.signClient.connect({
      optionalNamespaces: namespaces,
    });
    this.logger.debug({ uri, userId }, "Connected to the WalletConnect network");
    if (!uri) {
      this.client.events.emit("connection_failed", {
        error: {
          message: "Failed to connect to the WalletConnect network",
          code: 4001,
        },
        userId,
      });
      throw new Error("Failed to connect to the WalletConnect network");
    }

    const approvalAwaiter = createApprovalAwaiter(approval);
    this.emit("await_approval", {
      approval: approvalAwaiter,
      paymentIntents,
      userId,
      manualControl,
    });
    this.logger.debug("Emitted await_approval event");
    this.emit("qr_ready", { uri, userId });
    this.logger.debug({ uri, userId }, "Emitted qr_ready event");

    if (manualControl) {
      const session = await approvalAwaiter();
      this.manualControl[session.topic] = manualControl;
    }
  };

  public restart: IPOSClientEngine["restart"] = async (params) => {
    this.logger.debug({ params }, "Restarting");

    const { reinit, sessionTopic, userId } = params || {};
    if (reinit) {
      this.tokens = [];
      await this.disconnect({ sessionTopic });
      this.logger.debug("Restarted: Cleared payment intents, transactions and disconnected");
      return;
    }

    const topic = this.getSessionTopic(sessionTopic);
    const manualControl = this.manualControl[topic];
    // restart the payment intent flow from the beginning
    const paymentIntents = this.paymentIntents[topic];
    if (!paymentIntents || !paymentIntents?.length) {
      throw new Error("No payment intents found for session topic: " + topic);
    }
    await this.createPaymentIntent({
      paymentIntents,
      manualControl,
      userId,
      sessionTopic: topic,
    });
    this.logger.debug(
      { paymentIntents, userId },
      "Restarted: Created payment intent flow from the beginning",
    );
  };

  public connect: IPOSClientEngine["connect"] = async (params) => {
    const { userId } = params;
    const manualControl = true;
    const namespaces = this.composeNamespacesFromTokens();
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
        userId,
      });
      throw new Error("Failed to connect to the WalletConnect network");
    }

    const approvalAwaiter = createApprovalAwaiter(approval);
    this.emit("await_approval", {
      approval: approvalAwaiter,
      manualControl,
      paymentIntents: [],
      userId,
    });
    this.logger.debug({ userId }, "Emitted await_approval event");
    this.emit("qr_ready", { uri, userId });
    this.logger.debug({ uri, userId }, "Emitted qr_ready event");

    const session = await approvalAwaiter();
    this.manualControl[session.topic] = manualControl;
    return session;
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

  private composeNamespacesFromTokens(): ProposalTypes.OptionalNamespaces {
    const tokens = this.tokens;
    this.logger.debug({ tokens }, "Composing namespaces from tokens");

    if (tokens.length === 0) {
      throw new Error("No set tokens to compose namespaces from, call setTokens() first");
    }

    const namespaces: ProposalTypes.OptionalNamespaces = {};
    tokens.forEach((token) => {
      const { network } = token;
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

  private composeNamespacesFromPaymentIntents(
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
    async (params) => {
      const { sessionTopic, userId } = params;
      const topic = this.getSessionTopic(sessionTopic);

      const paymentIntents = this.paymentIntents[topic];
      if (!paymentIntents) {
        throw new Error("No payment intents found for session topic: " + topic);
      }

      const session = this.signClient.session.get(topic);
      this.logger.debug(
        {
          sessionTopic: topic,
          userId,
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
          userId,
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

      this.logger.debug({ payload, userId }, "Fetching wc_pos_buildTransactions");
      const response = await this.fetchRpcRequest<POSClientEngineTypes.RPCTransactions>({
        payload: JSON.stringify(payload),
        userId,
      });
      this.logger.debug({ response, userId }, "Received wc_pos_buildTransactions");
      this.transactions[session.topic] = response.result.transactions;

      this.logger.debug(
        {
          transactions: this.transactions[session.topic],
          userId,
        },
        "Payment intent to transactions map set",
      );
    };

  sendPaymentsToWallet: IPOSClientEngine["sendPaymentsToWallet"] = async (params = {}) => {
    const { sessionTopic, userId } = params;
    const topic = this.getSessionTopic(sessionTopic);

    if (!topic) {
      throw new Error("No session topic found, call createPaymentIntent() first");
    }

    if (this.paymentsSendingInProgress[topic]) {
      throw new Error("Payments are already being sent, please wait for them to complete");
    }
    this.paymentsSendingInProgress[topic] = true;

    try {
      await this.prepareTransactionsFromPaymentIntents({ sessionTopic: topic, userId });
      await this.sendTransactionsToWallet({ sessionTopic: topic, userId });
    } catch (error) {
      this.logger.error(error, "Error while sending payments to wallet");
      this.paymentsSendingInProgress[topic] = false;
      throw error;
    }
    this.paymentsSendingInProgress[topic] = false;
  };

  sendTransactionsToWallet: IPOSClientEngine["sendTransactionsToWallet"] = async (params) => {
    const { sessionTopic, userId } = params;
    const transactions = this.transactions[sessionTopic];
    const paymentIntents = this.paymentIntents[sessionTopic];
    if (!transactions || !paymentIntents) {
      throw new Error(
        "No transactions or payment intents to send, call createPaymentIntent() first",
      );
    }

    if (transactions.length !== paymentIntents.length) {
      throw new Error(
        `Mismatch between transactions (${transactions.length}) and payment intents (${paymentIntents.length}). ` +
          `The RPC response returned an unexpected number of transactions.`,
      );
    }

    this.logger.debug(
      {
        transactions,
        sessionTopic,
        userId,
      },
      "Sending transactions to wallet",
    );

    for (let i = 0; i < transactions.length; i++) {
      const transaction = transactions[i];
      const paymentIntent = paymentIntents[i];
      try {
        this.emit("payment_requested", { paymentIntent, transaction, sessionTopic, userId });
        this.logger.debug(
          {
            transactionId: transaction.id,
            userId,
          },
          "Emitted payment_requested event",
        );

        let result;
        try {
          result = await this.signClient.request({
            topic: sessionTopic,
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
              userId,
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
            sessionTopic,
            userId,
          });
          throw error;
        }
        this.emit("payment_broadcasted", {
          paymentIntent,
          transaction,
          result,
          sessionTopic,
          userId,
        });
        this.logger.debug(
          {
            transactionId: transaction.id,
            userId,
          },
          "Emitted payment_broadcasted event",
        );
        await this.awaitPaymentConfirmed({ transaction, result, sessionTopic, userId });
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        this.logger.error(error, "Error while awaiting payment confirmed");
      }
    }

    if (this.manualControl[sessionTopic] === true) return;
    await this.disconnect({ sessionTopic });
  };

  awaitPaymentConfirmed: IPOSClientEngine["awaitPaymentConfirmed"] = async (params) => {
    const { transaction, result, sessionTopic, userId } = params;
    try {
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
          { payload: JSON.stringify(payload), userId },
        );
        this.logger.debug(
          {
            transactionId: transaction.id,
            response,
          },
          "Received wc_pos_checkTransaction",
        );
        if (response.result.status === "CONFIRMED") {
          this.logger.debug({ response, userId }, "Transaction status confirmed");
          this.emit("payment_successful", {
            transaction,
            result,
            sessionTopic,
            userId,
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
            sessionTopic,
            userId,
          });
          transactionResult = response.result;
          break;
        } else if (response.result.status === "PENDING") {
          this.logger.debug({ response, userId }, "Transaction pending");
          await new Promise((resolve) => setTimeout(resolve, response.result.checkIn || 1000));
        }
      }
    } catch (error) {
      this.logger.error(error, "Error while awaiting payment confirmations");
      this.emit("payment_failed", {
        error: {
          message: (error as Error)?.message,
          code: 4001,
        },
        transaction,
        sessionTopic,
        userId,
      });
    }
  };

  private setupEventHandlers = () => {
    this.on("await_approval", async ({ approval, paymentIntents, userId, manualControl }) => {
      try {
        this.logger.debug("On await_approval");
        const session = await approval();
        this.setPaymentIntents({ sessionTopic: session.topic, paymentIntents });
        await this.onSessionConnected({ session, userId, manualControl });
      } catch (error) {
        this.logger.error(error, "Error while awaiting approval");
        this.emit("connection_rejected", {
          error: {
            message: (error as Error)?.message,
            code: 4001,
          },
          userId,
        });
      }
    });
  };

  onSessionConnected: IPOSClientEngine["onSessionConnected"] = async (params) => {
    const { session, userId, manualControl } = params;
    this.logger.debug({ sessionTopic: session.topic, userId }, "On session connected");
    this.emit("connected", { session, userId });
    // disable deep links for the session
    await this.signClient.session.update(session.topic, {
      sessionConfig: {
        disableDeepLink: true,
      },
    });
    this.logger.debug({ sessionTopic: session.topic, userId }, "Disabled deep links for session");
    this.logger.debug({ sessionTopic: session.topic, userId }, "Emitted connected event");

    if (manualControl === true) return;
    await this.sendPaymentsToWallet({ sessionTopic: session.topic, userId });
  };

  disconnect: IPOSClientEngine["disconnect"] = async (params = {}) => {
    try {
      const { sessionTopic } = params;
      const topicToDisconnect = this.getSessionTopic(sessionTopic);

      if (!topicToDisconnect) return;
      this.cleanup({ sessionTopic: topicToDisconnect });
      await this.signClient.disconnect({
        topic: topicToDisconnect,
        reason: { code: 4001, message: "User disconnected" },
      });
    } catch (error) {
      this.logger.error(error, "Error while disconnecting");
    }
  };

  private fetchRpcRequest = async <T>(params: { payload: string; userId?: string }): Promise<T> => {
    const { payload, userId } = params;
    this.logger.debug({ url: this.getRpcUrl(), payload, userId }, "Fetching RPC request");
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

    if (!result.ok || !data || data?.error) {
      const code = data?.error?.code || -18900;
      const message = RPC_ERROR_CODES?.[code]
        ? `${RPC_ERROR_CODES?.[code]}: ${data?.error?.message}`
        : data?.error?.message || "Failed to parse RPC response";
      this.emit("payment_failed", {
        error: {
          message,
          code,
        },
        transaction: "",
        sessionTopic: this.client.session?.topic || "",
        userId,
      });
      throw new Error(message);
    }
    return data as T;
  };

  // validates that the approved namespaces contain addresses that match ALL payment intents
  private validateApprovedNamespacesWithPaymentIntents = (sessionTopic: string) => {
    this.validateSessionTopic(sessionTopic);

    const session = this.signClient.session.get(sessionTopic);
    const paymentIntents = this.paymentIntents?.[sessionTopic];
    if (!session || !paymentIntents) {
      throw new Error("No session or payment intents found");
    }

    for (const paymentIntent of paymentIntents) {
      const { token } = paymentIntent;
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
    }
  };

  private setPaymentIntents = (params: {
    sessionTopic: string;
    paymentIntents: POSClientTypes.PaymentIntent[];
    userId?: string;
  }) => {
    const { sessionTopic, paymentIntents, userId } = params;
    this.paymentIntents[sessionTopic] = paymentIntents;
    this.logger.debug({ paymentIntents, userId }, "Payment intents set");
  };

  private cleanup = (params: { sessionTopic?: string } = {}) => {
    const { sessionTopic } = params;
    if (!sessionTopic) return;

    delete this.paymentIntents[sessionTopic];
    delete this.transactions[sessionTopic];
    delete this.manualControl[sessionTopic];
    delete this.paymentsSendingInProgress[sessionTopic];
    this.logger.debug({ sessionTopic }, "Cleaned up payment intents and transactions");
  };

  private getRpcUrl = () => {
    return RPC_URL({ projectId: this.client.opts.projectId, deviceId: this.client.opts.deviceId });
  };

  private validateSessionTopic = (sessionTopic?: string) => {
    if (!sessionTopic) return;
    try {
      this.signClient.session.get(sessionTopic);
    } catch (error) {
      this.logger.error(error, `No session found for topic: ${sessionTopic}`);
      throw new Error(`No session found for topic: ${sessionTopic}`);
    }
  };

  private getSessionTopic = (sessionTopic?: string): string => {
    if (!sessionTopic && this.client.sessions.length > 1) {
      throw new Error(
        "Multiple sessions found, please specify the session topic in the params: { sessionTopic: '...' }",
      );
    }

    const topic = sessionTopic || this.client.session?.topic;
    if (!topic) {
      throw new Error(
        "No session topic found. Please provide a sessionTopic or establish a session first.",
      );
    }
    this.validateSessionTopic(topic);
    return topic;
  };
}
