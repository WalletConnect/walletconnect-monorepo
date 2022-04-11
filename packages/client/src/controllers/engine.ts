import { FIVE_MINUTES } from "@walletconnect/time";
import { EngineTypes, ICrypto, IEngine, IPairing, IRelayer, ISession } from "@walletconnect/types";
import { calcExpiry, formatUri, generateRandomBytes32, parseUri } from "@walletconnect/utils";
import EventEmitter from "events";

export default class Engine implements IEngine {
  constructor(
    private relayer: IRelayer,
    private crypto: ICrypto,
    private session: ISession,
    private pairing: IPairing,
    private events: EventEmitter,
  ) {
    this.registerRelayerEvents();
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

  public async approveSession() {
    // TODO
  }

  public async rejectSession() {
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

  private registerRelayerEvents() {
    /**
     * TODO
     * onSessionPropose - receiver:Wallet get session proposal data from topic A
     * onSessionProposalResponse - receiver:Dapp get session proposal aproval and wallet data on topic A, derrive topic B
     * onSessionSettle - receiver:Dapp get full session data on topic B
     * onSessionSettleAcknowledgement - receiver:Wallet get acknowledgement about session settlement from dapp on topic B
     */
  }
}
