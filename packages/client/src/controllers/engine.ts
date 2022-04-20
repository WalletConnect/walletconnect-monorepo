import {
  formatJsonRpcRequest,
  formatJsonRpcResult,
  formatJsonRpcError,
  isJsonRpcRequest,
  isJsonRpcResponse,
  isJsonRpcResult,
  isJsonRpcError,
} from "@walletconnect/jsonrpc-utils";
import { FIVE_MINUTES, SEVEN_DAYS, THIRTY_DAYS } from "@walletconnect/time";
import {
  IEngine,
  RelayerTypes,
  EnginePrivate,
  SessionTypes,
  JsonRpcTypes,
} from "@walletconnect/types";
import {
  calcExpiry,
  formatUri,
  generateRandomBytes32,
  parseUri,
  createDelayedPromise,
} from "@walletconnect/utils";
import { RELAYER_EVENTS, RELAYER_DEFAULT_PROTOCOL } from "../constants";

export default class Engine extends IEngine {
  constructor(client: IEngine["client"]) {
    super(client);
    this.registerRelayerEvents();
    this.registerExpirerEvents();
  }

  // ---------- Public ------------------------------------------------ //

  public createSession: IEngine["createSession"] = async params => {
    // TODO(ilja) validate params

    const { pairingTopic, methods, events, chains, relays } = params;
    let topic = pairingTopic;
    let uri: string | undefined = undefined;
    let active = true;

    if (topic) {
      const pairing = await this.client.pairing.get(topic);
      active = pairing.active;
    }

    if (!topic || !active) {
      const { newTopic, newUri } = await this.createPairing();
      topic = newTopic;
      uri = newUri;
    }

    const publicKey = await this.client.crypto.generateKeyPair();
    const proposal = {
      methods: methods ?? [],
      events: events ?? [],
      chains: chains ?? [],
      relays: relays ?? [{ protocol: RELAYER_DEFAULT_PROTOCOL }],
      proposer: {
        publicKey,
        metadata: this.client.metadata,
      },
    };

    await this.client.proposal.set(publicKey, proposal);

    const { reject, resolve, settled } = createDelayedPromise<SessionTypes.Struct>();
    this.client.events.once("session_settle_request", () => {
      // TODO(ilja) check for error and reject
      reject();
      // TODO(ilja) check for success / data and resolve
      resolve();
    });

    await this.sendRequest(topic, "wc_sessionPropose", proposal);

    return { uri, approval: settled };
  };

  public pair: IEngine["pair"] = async params => {
    // TODO(ilja) validate pairing Uri
    const { topic, symKey, relay } = parseUri(params.uri);
    const expiry = calcExpiry(FIVE_MINUTES);
    const pairing = { topic, relay, expiry, active: true };
    await this.client.pairing.set(topic, pairing);
    await this.client.crypto.setPairingKey(symKey, topic);
    await this.client.relayer.subscribe(topic, { relay });
    // TODO(ilja) this.expirer / timeout pairing ?

    return pairing;
  };

  public approve: IEngine["approve"] = async params => {
    const { proposerPublicKey, relayProtocol, accounts, methods, events } = params;

    const selfPublicKey = await this.client.crypto.generateKeyPair();
    const sessionTopic = await this.client.crypto.generateSessionKey(
      selfPublicKey,
      proposerPublicKey,
    );
    const sessionPayload = {
      relay: {
        protocol: relayProtocol ?? "waku",
      },
      accounts,
      methods,
      events,
      controller: {
        publicKey: selfPublicKey,
        metadata: this.client.metadata,
      },
      expiry: calcExpiry(SEVEN_DAYS),
    };
    await this.client.relayer.subscribe(sessionTopic);
    await this.sendRequest(sessionTopic, "wc_sessionSettle", sessionPayload);

    const { pairingTopic, pairingRequestId } = await this.client.proposal.get(proposerPublicKey);
    if (pairingTopic && pairingRequestId) {
      await this.sendResult<"wc_sessionPropose">(pairingRequestId, pairingTopic, {
        relay: {
          protocol: relayProtocol ?? "waku",
        },
        responderPublicKey: selfPublicKey,
      });
      await this.client.proposal.delete(proposerPublicKey, { code: 1, message: "TODO(ilja)" });
      await this.client.pairing.update(pairingTopic, {
        active: true,
        expiry: calcExpiry(THIRTY_DAYS),
      });
    }

    const { settled, resolve, reject } = createDelayedPromise<SessionTypes.Struct>();

    // TODO(ilja) set up event listener to resolve promise when session is settled
    this.client.events.once("session_settle_response", () => {
      resolve();
      reject();
    });

    const session = await settled();

    return session;
  };

  public reject: IEngine["reject"] = async () => {
    // TODO
  };

  public updateAccounts: IEngine["updateAccounts"] = async params => {
    const { topic, accounts } = params;
    // TODO (ilja) validate session topic
    // TODO (ilja) validate that self is controller
    await this.sendRequest(topic, "wc_sessionUpdateAccounts", { accounts });
    const { resolve, reject, settled } = createDelayedPromise<void>();
    // TODO(ilja) set up event listener for update accounts and resolve, reject promise
    await settled();
    await this.client.session.update(topic, { accounts });
  };

  public updateMethods: IEngine["updateMethods"] = async () => {
    // TODO
  };

  public updateEvents: IEngine["updateEvents"] = async () => {
    // TODO
  };

  public updateExpiry: IEngine["updateExpiry"] = async () => {
    // TODO
  };

  public request: IEngine["request"] = async () => {
    // TODO
  };

  public respond: IEngine["respond"] = async () => {
    // TODO
  };

  public ping: IEngine["ping"] = async () => {
    // TODO
  };

  public emit: IEngine["emit"] = async () => {
    // TODO
  };

  public disconnect: IEngine["disconnect"] = async () => {
    // TODO
  };

  // ---------- Private ----------------------------------------------- //

  private async createPairing() {
    const symKey = generateRandomBytes32();
    const topic = await this.client.crypto.setPairingKey(symKey);
    const expiry = calcExpiry(FIVE_MINUTES);
    const relay = { protocol: RELAYER_DEFAULT_PROTOCOL };
    const pairing = { topic, expiry, relay, active: true };
    const uri = formatUri({
      protocol: this.client.protocol,
      version: this.client.version,
      topic,
      symKey,
      relay,
    });
    await this.client.pairing.set(topic, pairing);
    await this.client.relayer.subscribe(topic);
    // TODO(ilja) this.expirer / timeout pairing ?

    return { newTopic: topic, newUri: uri };
  }

  private sendRequest: EnginePrivate["sendRequest"] = async (topic, method, params) => {
    // TODO(ilja) validate method
    const payload = formatJsonRpcRequest(method, params);
    const message = await this.client.crypto.encode(topic, payload);
    await this.client.relayer.publish(topic, message);
    await this.client.history.set(topic, payload);

    return { id: payload.id };
  };

  private sendResult: EnginePrivate["sendResult"] = async (id, topic, result) => {
    const payload = formatJsonRpcResult(id, result);
    const message = await this.client.crypto.encode(topic, payload);
    await this.client.relayer.publish(topic, message);
    await this.client.history.resolve(payload);
  };

  private sendError: EnginePrivate["sendError"] = async (id, topic, error) => {
    const payload = formatJsonRpcError(id, error);
    const message = await this.client.crypto.encode(topic, payload);
    await this.client.relayer.publish(topic, message);
    await this.client.history.resolve(payload);
  };

  // ---------- Relay Events Router ----------------------------------- //

  private registerRelayerEvents() {
    this.client.relayer.on(RELAYER_EVENTS.message, async (event: RelayerTypes.MessageEvent) => {
      const { topic, message } = event;
      const payload = await this.client.crypto.decode(topic, message);

      if (isJsonRpcRequest(payload)) {
        await this.client.history.set(topic, payload);
        this.onRelayEventRequest({ topic, payload });
      } else if (isJsonRpcResponse(payload)) {
        await this.client.history.resolve(payload);
        this.onRelayEventResponse({ topic, payload });
      }
    });
  }

  private onRelayEventRequest: EnginePrivate["onRelayEventRequest"] = event => {
    const { topic, payload } = event;
    const reqMethod = payload.method as JsonRpcTypes.WcMethod;

    switch (reqMethod) {
      case "wc_sessionPropose":
        return this.onSessionProposeRequest(topic, payload);
      case "wc_sessionUpdateAccounts":
        return this.onSessionUpdateAccountsRequest(topic, payload);
      default:
        // TODO(ilja) throw / log unsuported event?
        return;
    }
  };

  private onRelayEventResponse: EnginePrivate["onRelayEventResponse"] = async event => {
    const { topic, payload } = event;
    const record = await this.client.history.get(topic, payload.id);
    const resMethod = record.request.method as JsonRpcTypes.WcMethod;

    switch (resMethod) {
      case "wc_sessionPropose":
        return this.onSessionProposeResponse(topic, payload);
      case "wc_sessionUpdateAccounts":
        return this.onSessionUpdateAccountsResponse(topic, payload);
      default:
        // TODO(ilja) throw / log unsuported event?
        return;
    }
  };

  // ---------- Relay Events Handlers ---------------------------------- //

  private onSessionProposeRequest: EnginePrivate["onSessionProposeRequest"] = async (
    topic,
    payload,
  ) => {
    const { params, id } = payload;
    await this.client.proposal.set(params.proposer.publicKey, {
      pairingTopic: topic,
      pairingRequestId: id,
      ...params,
    });
    this.client.events.emit("session_proposal_request", params);
  };

  private onSessionProposeResponse: EnginePrivate["onSessionProposeResponse"] = async (
    topic,
    payload,
  ) => {
    if (isJsonRpcResult(payload)) {
      const { result } = payload;
      const proposal = await this.client.proposal.get(topic);
      const selfPublicKey = proposal.proposer.publicKey;
      const peerPublicKey = result.responderPublicKey;
      const sessionTopic = await this.client.crypto.generateSessionKey(
        selfPublicKey,
        peerPublicKey,
      );
      await this.client.relayer.subscribe(sessionTopic);
      // TODO(ilja) subscribe to topic_b
    } else if (isJsonRpcError(payload)) {
      // TODO(ilja) handle error
    }
  };

  private onSessionUpdateAccountsRequest: EnginePrivate["onSessionUpdateAccountsRequest"] = async (
    topic,
    payload,
  ) => {
    const { params, id } = payload;
    // TODO(ilja) validate session topic
    // TODO(ilja) validate that self is NOT controller
    await this.client.session.update(topic, { accounts: params.accounts });
    await this.sendResult<"wc_sessionUpdateAccounts">(id, topic, true);
  };

  private onSessionUpdateAccountsResponse: EnginePrivate["onSessionUpdateAccountsResponse"] = async (
    // TODO(pedro) remove underscore when its used
    _topic,
    payload,
  ) => {
    const { id } = payload;
    if (isJsonRpcResult(payload)) {
      // TODO(ilja) emit associated success event
    } else if (isJsonRpcError(payload)) {
      // TODO(ilja) emit associated error event
    }
  };

  // ---------- Expirer Events ----------------------------------------- //

  private registerExpirerEvents() {
    // TODO
  }
}
