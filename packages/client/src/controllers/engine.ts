import {
  formatJsonRpcRequest,
  isJsonRpcRequest,
  isJsonRpcResponse,
} from "@walletconnect/jsonrpc-utils";
import {
  EngineTypes,
  ICrypto,
  IEngine,
  IPairing,
  IRelayer,
  ISession,
  JsonRpc,
  RelayerTypes,
} from "@walletconnect/types";
import {
  formatCreatePairingPayload,
  formatUri,
  generateRandomBytes32,
  parseUri,
} from "@walletconnect/utils";
import { RELAYER_EVENTS, WC_RPC_METHODS } from "../constants";

export default class Engine extends IEngine {
  constructor(relayer: IRelayer, crypto: ICrypto, session: ISession, pairing: IPairing) {
    super(relayer, crypto, session, pairing);
    this.registerRelayerEvents();
    this.registerExpirerEvents();
  }

  // ---------- Public ------------------------------------------------ //

  public async createSession(params: EngineTypes.CreateSessionParams) {
    // TODO(ilja) validate params
    let topic = params.pairingTopic;
    let uri = "";

    if (topic) {
      // TODO(ilja) get and validate existing pairing
      // TODO(ilja) set topic and uri
    } else {
      const { pairingTopic, pairingUri } = await this.createPairing(params.relay);
      topic = pairingTopic;
      uri = pairingUri;
    }

    const proposerPublicKey = await this.crypto.generateKeyPair();
    const newSession = {};
    this.session.set(topic, newSession);
    const requestParams: JsonRpc.SessionProposeRequest["params"] = {
      relays: params.relays,
      methods: params.methods ?? [],
      events: params.events ?? [],
      chains: params.chains ?? [],
      proposer: {
        publicKey: proposerPublicKey,
        metadata: params.metadata,
      },
    };

    // TODO(ilja) move this into request
    const request = formatJsonRpcRequest(WC_RPC_METHODS.WC_SESSION_PROPOSE, requestParams);
    this.sendRequest(request);

    return {
      uri,
      approval: new Promise(resolve => resolve()) as Promise<void>,
    };
  }

  public async pair(pairingUri: string) {
    // TODO(ilja) validate pairing Uri
    const { topic, symKey, relay } = parseUri(pairingUri);
    this.crypto.setSymKey(symKey, topic);
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

  private async createPairing(relay: EngineTypes.CreatePairingParams) {
    const pairingTopic = generateRandomBytes32();
    const symKey = await this.crypto.generateSymKey(pairingTopic);
    const pairing = formatCreatePairingPayload(pairingTopic, relay);

    const pairingUri = formatUri({
      ...pairing,
      symKey,
      relayProtocol: relay.protocol,
      relayData: relay.data,
    });

    this.pairing.set(pairingTopic, pairing);
    this.relayer.subscribe(pairingTopic);

    return { pairingTopic, pairingUri };
  }

  private sendRequest() {
    // Encode payload
    // Send request to relay
    // TODO(ilja) this.history.set()
  }

  private sendResponse() {
    // Encode payload
    // Send request to relay
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
    // onSessionProposeRequest
    // onPairingDeleteRequest
    // onPairingPingRequest
  }

  private onPairingRelayEventResponse({ topic, payload }: EngineTypes.DecodedRelayEvent) {
    // onSessionProposeResponse
    // onPairingDeleteResponse
    // onPairingPingResponse
  }

  private onSessionRelayEventRequest({ topic, payload }: EngineTypes.DecodedRelayEvent) {
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
