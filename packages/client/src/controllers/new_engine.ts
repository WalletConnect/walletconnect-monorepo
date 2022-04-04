import { ISequence, RelayerTypes, SequenceTypes } from "@walletconnect/types";
import { generateRandomBytes32 } from "@walletconnect/utils";

export default class Engine {
  constructor(public sequence: ISequence) {}

  /**
   * Public Methds
   */
  public async createPairing(params: SequenceTypes.CreateParams) {
    await this.sequence.validatePropose(params);
    const topic = generateRandomBytes32();
    const symetricKey = await this.sequence.client.crypto.generateSymKey(topic);
    const pairingUri = this.createPairingUri(topic, symetricKey, params.relay);
    this.sequence.pending.set(topic /* TODO create sequence data */);
    this.sequence.client.relayer.subscribe(topic);

    return pairingUri;
  }

  public createSession() {}

  /**
   * Private Methods
   */
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
}
