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
     * @TODO 1 - this.pairing.create(topic, params)
     * Create and store pairing.
     */
    this.sequence.client.relayer.subscribe(pairingTopic);
    await this.createSession(pairingTopic, params);

    return pairingUri;
  }

  public async createSession(pairingTopic: string, params: SequenceTypes.CreateParams) {
    const selfPublicKey = await this.sequence.client.crypto.generateKeyPair();
    /**
     * @TODO 2 - this.session.create(params)
     * Creates and store session proposal alongside daps public key.
     */
    /**
     * @TODO 3 - Consturct json rpc message for session proposal
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
     * @TODO 5 - this.pairing.createFromUri(pairingUri)
     * Creates and store pairing from pairingUri
     */
    this.sequence.client.relayer.subscribe(topic);
  }

  private registerEventListeners() {
    /**
     * @TODO
     * onSessionPropose - receiver:Wallet get session proposal data from topic A
     * onSessionProposalResponse - receiver:Dapp get session proposal aproval and wallet data on topic A, derrive topic B
     * onSessionSettle - receiver:Dapp get full session data on topic B
     * onSessionSettleResponse - receiver:Wallet get acknowledgement about session settlement from dapp on topic B
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
