import {
  formatJsonRpcRequest,
  isJsonRpcRequest,
  isJsonRpcResponse,
} from "@walletconnect/jsonrpc-utils";
import { FIVE_MINUTES, toMiliseconds } from "@walletconnect/time";
import { EngineTypes, IEngine, RelayerTypes, EnginePrivate } from "@walletconnect/types";
import { calcExpiry, formatUri, generateRandomBytes32, parseUri } from "@walletconnect/utils";
import { RELAYER_EVENTS, RELAYER_DEFAULT_PROTOCOL } from "../constants";

export default class Engine extends IEngine {
  constructor(
    history: IEngine["history"],
    protocol: IEngine["protocol"],
    version: IEngine["version"],
    relayer: IEngine["relayer"],
    crypto: IEngine["crypto"],
    session: IEngine["session"],
    pairing: IEngine["pairing"],
    proposal: IEngine["proposal"],
    metadata: IEngine["metadata"],
  ) {
    super(history, protocol, version, relayer, crypto, session, pairing, proposal, metadata);
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
      const pairing = await this.pairing.get(topic);
      active = pairing.active;
    }

    if (!topic || !active) {
      const { newTopic, newUri } = await this.createPairing();
      topic = newTopic;
      uri = newUri;
    }

    const publicKey = await this.crypto.generateKeyPair();
    const proposal = {
      methods: methods ?? [],
      events: events ?? [],
      chains: chains ?? [],
      relays: relays ?? [{ protocol: RELAYER_DEFAULT_PROTOCOL }],
      proposer: {
        publicKey,
        metadata: this.metadata,
      },
    };

    await this.proposal.set(publicKey, proposal);
    await this.sendRequest(topic, "wc_sessionPropose", proposal);

    // @ts-expect-error
    const approval = new Promise<void>(async (resolve, reject) => {
      setTimeout(reject, toMiliseconds(FIVE_MINUTES));
      // TODO(ilja) - resolve on approval event
      // TODO(ilja) - reject on reject event
    });

    return { uri, approval };
  };

  public pair: IEngine["pair"] = async pairingUri => {
    // TODO(ilja) validate pairing Uri
    const { topic, symKey, relay } = parseUri(pairingUri);
    this.crypto.setPairingKey(symKey, topic);
    // TODO(ilja) this.generatePairing(params)
    // TODO(ilja) this.pairing.set(topic, params)
    this.relayer.subscribe(topic, { relay });
  };

  public approve: IEngine["approve"] = async () => {
    // TODO
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
    const topic = generateRandomBytes32();
    const symKey = generateRandomBytes32();
    this.crypto.setPairingKey(symKey, topic);
    const expiry = calcExpiry(FIVE_MINUTES);
    const relay = { protocol: RELAYER_DEFAULT_PROTOCOL };
    const pairing = { topic, expiry, relay, active: true };
    const uri = formatUri({ protocol: this.protocol, version: this.version, topic, symKey, relay });
    await this.pairing.set(topic, pairing);
    await this.relayer.subscribe(topic);
    // TODO(ilja) set expirer

    return { newTopic: topic, newUri: uri };
  }

  private sendRequest: EnginePrivate["sendRequest"] = async (topic, method, params) => {
    // TODO(ilja) validate method

    const request = formatJsonRpcRequest(method, params);
    const message = await this.crypto.encode(topic, request);
    await this.relayer.publish(topic, message);

    if (method === "wc_sessionRequest") {
      await this.history.set(topic, request);
    }
  };

  // @ts-ignore
  private sendResponse: EnginePrivate["sendResponse"] = async () => {
    // TODO(ilja) encode payload
    // TODO(ilja) publish request to relay
    // TODO(ilja) this.history.resolve()
  };

  // ---------- Relay Events ------------------------------------------- //

  private registerRelayerEvents() {
    this.relayer.on(RELAYER_EVENTS.message, async (event: RelayerTypes.MessageEvent) => {
      const { topic, message } = event;
      const payload = await this.crypto.decode(topic, message);
      if (isJsonRpcRequest(payload)) {
        // TODO(ilja) this.history.set()
        if (this.pairing.topics.includes(topic)) {
          this.onPairingRelayEventRequest({ topic, payload });
        } else if (this.session.topics.includes(topic)) {
          this.onSessionRelayEventRequest({ topic, payload });
        }
      } else if (isJsonRpcResponse(payload)) {
        // TODO(ilja) this.history.resolve()
        if (this.pairing.topics.includes(topic)) {
          this.onPairingRelayEventResponse({ topic, payload });
        } else if (this.session.topics.includes(topic)) {
          this.onSessionRelayEventResponse({ topic, payload });
        }
      }
    });
  }

  // @ts-expect-error
  private onPairingRelayEventRequest({ topic, payload }: EngineTypes.DecodedRelayEvent) {
    // NOTE Some of these may not be needed
    // TODO(ilja) switch stateemnt on method
    // onSessionProposeRequest
    // onPairingDeleteRequest
    // onPairingPingRequest
  }

  // @ts-expect-error
  private onPairingRelayEventResponse({ topic, payload }: EngineTypes.DecodedRelayEvent) {
    // NOTE Some of these may not be needed
    // TODO(ilja) switch stateemnt on method
    // onSessionProposeResponse
    // onPairingDeleteResponse
    // onPairingPingResponse
  }

  // @ts-expect-error
  private onSessionRelayEventRequest({ topic, payload }: EngineTypes.DecodedRelayEvent) {
    // NOTE Some of these may not be needed
    // TODO(ilja) switch stateemnt on method
    // onSessionSettleRequest
    // onSessionUpdateAccountsRequest
    // onSessionUpdateMethodsRequest
    // onSessionUpdateEventsRequest
    // onSessionUpdateExpiryRequest
    // onSessionDeleteRequest
    // onSessionPingRequest
    // onSessionRequest
    // onSessionEventRequest
  }

  // @ts-expect-error
  private onSessionRelayEventResponse({ topic, payload }: EngineTypes.DecodedRelayEvent) {
    // NOTE Some of these may not be needed
    // TODO(ilja) switch stateemnt on method
    // onSessionSettleResponse
    // onSessionUpdateAccountsResponse
    // onSessionUpdateMethodsResponse
    // onSessionUpdateEventsResponse
    // onSessionUpdateExpiryResponse
    // onSessionDeleteResponse
    // onSessionPingResponse
    // onSessionRequestResponse
    // onSessionEventResponse
  }

  // ---------- Expirer Events ----------------------------------------- //

  private registerExpirerEvents() {
    // TODO
  }
}
