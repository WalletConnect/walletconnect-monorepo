import { ISequence, RelayerTypes, SequenceTypes } from "@walletconnect/types";
import { generateRandomBytes32 } from "@walletconnect/utils";

export default class Engine {
  constructor(public sequence: ISequence) {
    this.registerEventListeners();
  }

  public async createSession(params: SequenceTypes.CreateParams, topic?: string) {
    // validate params
    if (!topic) {
      await this.createPairing(params);
    }
    const selfPublicKey = await this.sequence.client.crypto.generateKeyPair();
    // const session = this.generateSession(params)
    // this.session.set(session)
    // const message = this.generateSessionMessage(session)
    // this.send(topic, message)
  }

  public async createPairing(params: SequenceTypes.CreateParams) {
    const topic = generateRandomBytes32();
    const symetricKey = await this.sequence.client.crypto.generateSymKey(topic);
    const pairingUri = this.createPairingUri(topic, symetricKey, params.relay);
    // this.pairing.set(topic, pairing)
    this.sequence.client.relayer.subscribe(topic);

    return { topic, pairingUri };
  }

  public async pair(pairingUri: string) {
    // validate pairing Uri
    const { topic, params } = this.getPairingUriParams(pairingUri);
    this.sequence.client.crypto.setSymKey(params.symKey, topic);
    // this.generatePairing(params)
    // this.pairing.set(topic, params)
    this.sequence.client.relayer.subscribe(topic);
  }

  private registerEventListeners() {
    /**
     * @TODO
     * onSessionPropose - receiver:Wallet get session proposal data from topic A
     * onSessionProposalResponse - receiver:Dapp get session proposal aproval and wallet data on topic A, derrive topic B
     * onSessionSettle - receiver:Dapp get full session data on topic B
     * onSessionSettleAck - receiver:Wallet get acknowledgement about session settlement from dapp on topic B
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
