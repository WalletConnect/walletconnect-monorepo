import { ISequence, RelayerTypes, SequenceTypes } from "@walletconnect/types";
import { generateRandomBytes32 } from "@walletconnect/utils";

export default class Engine {
  constructor(public sequence: ISequence) {
    this.registerEventListeners();
  }

  public async createPairing(params: SequenceTypes.CreateParams) {
    await this.sequence.validatePropose(params);
    const pairingTopic = generateRandomBytes32();
    const symetricKey = await this.sequence.client.crypto.generateSymKey(pairingTopic);
    const pairingUri = this.createPairingUri(pairingTopic, symetricKey, params.relay);
    /**
     * @TODO 1 - this.sequence.pairing.create(topic, params)
     * Create and persist pairing. Should add expiry field.
     */
    this.sequence.client.relayer.subscribe(pairingTopic);
    await this.createSession(pairingTopic, params);

    return pairingUri;
  }

  public async createSession(pairingTopic: string, params: SequenceTypes.CreateParams) {
    const selfPublicKey = await this.sequence.client.crypto.generateKeyPair();
    /**
     * @TODO 2 - this.sequence.session.create(params)
     * Creates and persists session.
     */
    /**
     * @TODO 3 - Constructs session proposal message and sends it on pairing topic A
     */
    const message = "";
    await this.sequence.client.relayer.publish(pairingTopic, message);
  }

  public async pair(pairingUri: string) {
    /**
     * @TODO 4 - Validate pairing uri
     */
    const { topic, params } = this.getPairingUriParams(pairingUri);
    this.sequence.client.crypto.setSymKey(params.symKey, topic);
    /**
     * @TODO 5 - this.sequence.pairing.createFromUri(pairingUri)
     * Creates and stores pairing from given uri
     */
    this.sequence.client.relayer.subscribe(topic);
  }

  private registerEventListeners() {
    /**
     * @TODO
     * onSessionPropose - receiver:Wallet Gets session proposal data sent on topic A
     * onSessionProposalResponse - receiver:Dapp Gets session aproval from wallet and data to derrive topic B
     * onSessionSettle - receiver:Dapp After subscribing to topic B dapp gets full session data on topic B
     * onSessionSettleResponse - receiver:Wallet Gets session settlement acknowledgement from dapp
     */
  }

  private settleSession() {}

  // Private methods that will likely move to @waleltconnect/utils

  private createPairingUri(
    topic: string,
    symetricKey: string,
    relay: RelayerTypes.ProtocolOptions,
  ) {
    const protocol = this.sequence.client.protocol;
    const version = this.sequence.client.version;
    const relayProtocol = `?relay-protocol=${relay.protocol}`;
    const relayData = relay.params ? `&relay-data=${relay.params}` : "";
    const symKey = `&symKey=${symetricKey}`;

    return `${protocol}:${topic}@${version}${relayProtocol}${relayData}${symKey}`;
  }

  private getPairingUriParams(pairingUri: string) {
    const [protocolData, query] = pairingUri.split("?");
    const topic = protocolData.split(":")[1].slice(0, -1);
    const variables = query.split("&");
    const params: Record<string, string> = {};
    variables.forEach(variable => {
      const [key, value] = variable.split("&");
      params[key] = value;
    });

    return { topic, params };
  }
}
