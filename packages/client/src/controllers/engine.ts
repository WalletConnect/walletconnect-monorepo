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

export default class Engine implements IEngine {
  constructor(
    private relayer: IRelayer,
    private crypto: ICrypto,
    private session: ISession,
    private pairing: IPairing,
  ) {
    this.registerEventListeners();
  }

  public async createSession(params: EngineTypes.CreateSessionParams) {
    const { pairingTopic, relay } = params;
    // TODO validate create session params
    let topic = pairingTopic;
    if (!topic) {
      const { newTopic } = await this.createPairing(relay);
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
    const { topic, symetricKey } = parseUri(pairingUri);
    this.crypto.setSymKey(symetricKey, topic);
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

  public async notify() {
    // TODO
  }

  public async disconnect() {
    // TODO
  }

  // ---------- Private ----------------------------------------------- //

  private async createPairing({ protocol, data }: RelayerTypes.ProtocolOptions) {
    const newTopic = generateRandomBytes32();
    const symetricKey = await this.crypto.generateSymKey(newTopic);
    const pairingPayload = {
      topic: newTopic,
      symetricKey,
      version: 2,
      relayProtocol: protocol,
      relayData: data,
    };
    const pairingUri = formatUri(pairingPayload);
    const pairingExpiry = calcExpiry(FIVE_MINUTES);
    const newPairing = {
      ...pairingPayload,
      expiry: pairingExpiry,
      uri: pairingUri,
      isActive: true,
    };
    this.pairing.set(newTopic, newPairing);
    this.relayer.subscribe(newTopic);

    return { newTopic, pairingUri };
  }

  private registerEventListeners() {
    /**
     * TODO
     * onSessionPropose - receiver:Wallet get session proposal data from topic A
     * onSessionProposalResponse - receiver:Dapp get session proposal aproval and wallet data on topic A, derrive topic B
     * onSessionSettle - receiver:Dapp get full session data on topic B
     * onSessionSettleAcknowledgement - receiver:Wallet get acknowledgement about session settlement from dapp on topic B
     */
  }
}
