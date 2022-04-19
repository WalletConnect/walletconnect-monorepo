import {
  formatJsonRpcRequest,
  isJsonRpcRequest,
  isJsonRpcResponse,
  JsonRpcRequest,
  JsonRpcResponse,
} from "@walletconnect/jsonrpc-utils";
import { FIVE_MINUTES, toMiliseconds } from "@walletconnect/time";
import {
  EngineTypes,
  IEngine,
  RelayerTypes,
  EnginePrivate,
  SessionTypes,
  JsonRpcTypes,
} from "@walletconnect/types";
import { calcExpiry, formatUri, generateRandomBytes32, parseUri } from "@walletconnect/utils";
import { RELAYER_EVENTS, RELAYER_DEFAULT_PROTOCOL } from "../constants";
import { Promises } from "./promises";

export default class Engine extends IEngine {
  promises: IEngine["promises"];

  constructor(client: IEngine["client"]) {
    super(client);
    this.promises = new Promises();
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
    const { id } = await this.sendRequest(topic, "wc_sessionPropose", proposal);

    const approval = this.promises.initiate<void>(id, toMiliseconds(FIVE_MINUTES));

    return { uri, approval };
  };

  public pair: IEngine["pair"] = async params => {
    // TODO(ilja) validate pairing Uri
    const { topic, symKey, relay } = parseUri(params.uri);
    this.client.crypto.setPairingKey(symKey, topic);
    // TODO(ilja) this.pairing.set(topic, params)
    // TODO(ilja) this.expirer ?
    this.client.relayer.subscribe(topic, { relay });
  };

  public approve: IEngine["approve"] = async () => {
    // TODO
    return {} as SessionTypes.Struct;
  };

  public reject: IEngine["reject"] = async () => {
    // TODO
  };

  public updateAccounts: IEngine["updateAccounts"] = async () => {
    // TODO
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
    // TODO(ilja) this.expirer ?

    return { newTopic: topic, newUri: uri };
  }

  private sendRequest: EnginePrivate["sendRequest"] = async (topic, method, params) => {
    // TODO(ilja) validate method
    const request = formatJsonRpcRequest(method, params);
    const message = await this.client.crypto.encode(topic, request);
    await this.client.relayer.publish(topic, message);
    await this.client.history.set(topic, request);

    return { id: request.id };
  };

  private sendResponse: EnginePrivate["sendResponse"] = async (topic, response) => {
    const message = await this.client.crypto.encode(topic, response);
    await this.client.relayer.publish(topic, message);
    await this.client.history.resolve(response);
    // TODO(ilja) this.expirer?
  };

  // ---------- Relay Events ------------------------------------------- //

  private registerRelayerEvents() {
    this.client.relayer.on(RELAYER_EVENTS.message, async (event: RelayerTypes.MessageEvent) => {
      const { topic, message } = event;
      const payload = await this.client.crypto.decode(topic, message);
      if (isJsonRpcRequest(payload)) {
        this.onRelayEventRequest({ topic, payload });
      } else if (isJsonRpcResponse(payload)) {
        this.onRelayEventResponse({ topic, payload });
      }
    });
  }

  private onRelayEventRequest(event: EngineTypes.EventCallback<JsonRpcRequest>) {
    const { topic, payload } = event;
    const reqMethod = payload.method as JsonRpcTypes.WcMethod;

    if (this.client.pairing.topics.includes(topic)) {
      switch (reqMethod) {
        case "wc_sessionPropose":
          return this.onSessionProposeRequest(topic, payload);
        default:
          // TODO(ilja) throw unsuported event
          return false;
      }
    } else if (this.client.session.topics.includes(topic)) {
      // TODO
    }

    // TODO(ilja) throw unsuported event
    return false;
  }

  private async onRelayEventResponse(event: EngineTypes.EventCallback<JsonRpcResponse>) {
    const { topic, payload } = event;
    const record = await this.client.history.get(topic, payload.id);
    const resMethod = record.request.method as JsonRpcTypes.WcMethod;

    if (this.client.pairing.topics.includes(topic)) {
      switch (resMethod) {
        case "wc_sessionPropose":
          break;

        default:
          break;
      }
    } else if (this.client.session.topics.includes(topic)) {
      // TODO
    }
  }

  // ---------- Relay Events Handlers ---------------------------------- //

  private onSessionProposeRequest: EnginePrivate["onSessionProposeRequest"] = (topic, payload) => {
    this.client.proposal.set(topic, payload.params);
    // TODO(ilja) emit event for approval
  };

  // ---------- Expirer Events ----------------------------------------- //

  private registerExpirerEvents() {
    // TODO
  }
}
