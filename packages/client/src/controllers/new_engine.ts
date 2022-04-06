import { ICrypto, IRelayer, SequenceTypes } from "@walletconnect/types";
import { formatUri, generateRandomBytes32, parseUri } from "@walletconnect/utils";

export default class Engine {
  constructor(
    private relayer: IRelayer,
    private crypto: ICrypto,
    private session: any, // TODO will be new store
    private pairing: any, // TODO will be new store
  ) {
    this.registerEventListeners();
  }

  public async createSession(params: SequenceTypes.CreateParams, pairingTopic?: string) {
    // TODO validate params
    let topic = pairingTopic;
    if (!topic) {
      const { newTopic } = await this.createPairing(params);
      topic = newTopic;
    }
    const selfPublicKey = await this.crypto.generateKeyPair();
    // const session = formatSession()
    this.session.set(topic, session);
    // const message = this.generateSessionMessage(session)
    // this.send(topic, message)
  }

  public async createPairing(params: SequenceTypes.CreateParams) {
    const { relay } = params;
    const newTopic = generateRandomBytes32();
    const symetricKey = await this.crypto.generateSymKey(newTopic);
    const pairingUri = formatUri({
      topic: newTopic,
      symetricKey,
      version: 2,
      relayProtocol: relay.protocol,
      relayData: relay.data,
    });
    this.pairing.set(newTopic, pairing);
    this.relayer.subscribe(newTopic);

    return { newTopic, pairingUri };
  }

  public async pair(pairingUri: string) {
    // validate pairing Uri
    const { topic, symetricKey } = parseUri(pairingUri);
    this.crypto.setSymKey(symetricKey, topic);
    // this.generatePairing(params)
    // this.pairing.set(topic, params)
    this.relayer.subscribe(topic);
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
