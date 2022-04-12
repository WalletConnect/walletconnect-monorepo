import { isJsonRpcRequest, isJsonRpcResponse } from "@walletconnect/jsonrpc-utils";
import { FIVE_MINUTES } from "@walletconnect/time";
import {
  EngineTypes,
  ICrypto,
  IEngine,
  IPairing,
  IRelayer,
  ISession,
  RelayerTypes,
} from "@walletconnect/types";
import { calcExpiry, formatUri, generateRandomBytes32, parseUri } from "@walletconnect/utils";
import { RELAYER_EVENTS } from "../constants";

export default class Engine extends IEngine {
  constructor(relayer: IRelayer, crypto: ICrypto, session: ISession, pairing: IPairing) {
    super(relayer, crypto, session, pairing);
    this.registerRelayerEvents();
    this.registerExpirerEvents();
  }

  public async createSession(params: EngineTypes.CreateSessionParams) {
    // TODO(ilja) validate params
    const { pairingTopic, relay } = params;
    let topic = pairingTopic;

    if (topic) {
      // TODO(ilja) get and validate existing pairing
    } else {
      const { pairingTopic: newTopic } = await this.createPairing(relay);
      topic = newTopic;
    }

    const selfPublicKey = await this.crypto.generateKeyPair();
    const newSession = {};
    this.session.set(topic, newSession);
    // const message = this.generateSessionMessage(session)
    // this.send(topic, message)
  }

  public async pair(pairingUri: string) {
    // TODO validate pairing Uri
    const { topic, symKey } = parseUri(pairingUri);
    this.crypto.setSymKey(symKey, topic);
    // this.generatePairing(params)
    // this.pairing.set(topic, params)
    this.relayer.subscribe(topic);
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
    const sharedPairingData = {
      topic: pairingTopic,
      version: 2,
    };
    const pairingUriData = {
      ...sharedPairingData,
      symKey,
      relayProtocol: relay.protocol,
      relayData: relay.data,
    };
    const pairingUri = formatUri(pairingUriData);
    const pairingExpiry = calcExpiry(FIVE_MINUTES);
    const pairingData = {
      ...sharedPairingData,
      relay,
      expiry: pairingExpiry,
      uri: pairingUri,
      isActive: true,
    };
    this.pairing.set(pairingTopic, pairingData);
    this.relayer.subscribe(pairingTopic);

    return { pairingTopic, pairingUri };
  }

  // ---------- Relay Events ------------------------------------------- //

  private registerRelayerEvents() {
    this.relayer.on(RELAYER_EVENTS.message, async (event: RelayerTypes.MessageEvent) => {
      const { topic, message } = event;
      const payload = await this.crypto.decode(topic, message);
      if (this.pairing.topics.includes(topic)) {
        if (isJsonRpcRequest(payload)) {
          this.onPairingRelayEventRequest({ topic, payload });
        } else if (isJsonRpcResponse(payload)) {
          this.onPairingRelayEventResponse({ topic, payload });
        }
      } else if (this.session.topics.includes(topic)) {
        if (isJsonRpcRequest(payload)) {
          this.onSessionRelayEventRequest({ topic, payload });
        } else if (isJsonRpcResponse(payload)) {
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
