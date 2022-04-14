import {
  formatJsonRpcRequest,
  isJsonRpcRequest,
  isJsonRpcResponse,
} from "@walletconnect/jsonrpc-utils";
import { FIVE_MINUTES, toMiliseconds } from "@walletconnect/time";
import { EngineTypes, IEngine, RelayerTypes } from "@walletconnect/types";
import { calcExpiry, formatUri, generateRandomBytes32, parseUri } from "@walletconnect/utils";
import { RELAYER_EVENTS, WC_RPC_METHODS, RELAYER_DEFAULT_PROTOCOL } from "../constants";

export default class Engine extends IEngine {
  constructor(
    protocol: IEngine["protocol"],
    version: IEngine["version"],
    relayer: IEngine["relayer"],
    crypto: IEngine["crypto"],
    session: IEngine["session"],
    pairing: IEngine["pairing"],
    proposal: IEngine["proposal"],
    metadata: IEngine["metadata"],
  ) {
    super(protocol, version, relayer, crypto, session, pairing, proposal, metadata);
    this.registerRelayerEvents();
    this.registerExpirerEvents();
  }

  // ---------- Public ------------------------------------------------ //

  public async createSession(params: EngineTypes.CreateSessionParams) {
    // TODO(ilja) validate params

    const { pairingTopic, methods, events, chains, relays } = params;
    let topic = pairingTopic;
    let uri: string | undefined = undefined;

    if (topic) {
      // TODO(ilja) verify topic has existing and active pairing
    } else {
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
    this.sendRequest("WC_SESSION_PROPOSE", proposal);

    const approval = new Promise(async (resolve, reject) => {
      setTimeout(reject, toMiliseconds(FIVE_MINUTES));
      // TODO(ilja) - resolve on approval event
      // TODO(ilja) - reject on reject event
    });

    return { uri, approval };
  }

  public async pair(pairingUri: string) {
    // TODO(ilja) validate pairing Uri
    const { topic, symKey, relay } = parseUri(pairingUri);
    this.crypto.setPairingKey(symKey, topic);
    // TODO(ilja) this.generatePairing(params)
    // TODO(ilja) this.pairing.set(topic, params)
    this.relayer.subscribe(topic, relay);
  }

  public async approve() {
    // TODO
  }

  public async reject() {
    // TODO
  }

  public async updateAccounts() {
    // TODO
  }

  public async updateMethods() {
    // TODO
  }

  public async updateEvents() {
    // TODO
  }

  public async updateExpiry() {
    // TODO
  }

  public async request() {
    // TODO
  }

  public async respond() {
    // TODO
  }

  public async ping() {
    // TODO
  }

  public async emit() {
    // TODO
  }

  public async disconnect() {
    // TODO
  }

  // ---------- Private ----------------------------------------------- //

  private async createPairing() {
    const topic = generateRandomBytes32();
    const symKey = await this.crypto.generatePairingKey(topic);
    const expiry = calcExpiry(FIVE_MINUTES);
    const relay = { protocol: RELAYER_DEFAULT_PROTOCOL };
    const pairing = { topic, expiry, relay, active: true };
    const uri = formatUri({ protocol: this.protocol, version: this.version, topic, symKey, relay });
    await this.pairing.set(topic, pairing);
    await this.relayer.subscribe(topic);
    // TODO(ilja) set expirer

    return { newTopic: topic, newUri: uri };
  }

  private sendRequest(method: keyof typeof WC_RPC_METHODS, params: Record<string, unknown>) {
    // TODO(ilja) validate method

    const request = formatJsonRpcRequest(method, params);

    // TODO(ilja) encode payload
    // TODO(ilja) publish request to relay
    // TODO(ilja) this.history.set()
  }

  private sendResponse() {
    // TODO(ilja) encode payload
    // TODO(ilja) publish request to relay
    // TODO(ilja) this.history.resolve()
  }

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

  private onPairingRelayEventRequest({ topic, payload }: EngineTypes.DecodedRelayEvent) {
    // NOTE Some of these may not be needed
    // TODO(ilja) switch stateemnt on method
    // onSessionProposeRequest
    // onPairingDeleteRequest
    // onPairingPingRequest
  }

  private onPairingRelayEventResponse({ topic, payload }: EngineTypes.DecodedRelayEvent) {
    // NOTE Some of these may not be needed
    // TODO(ilja) switch stateemnt on method
    // onSessionProposeResponse
    // onPairingDeleteResponse
    // onPairingPingResponse
  }

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
