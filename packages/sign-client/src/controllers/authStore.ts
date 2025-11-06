import { Logger } from "@walletconnect/logger";
import { IAuth, ICore } from "@walletconnect/types";
import { AuthPairingTopic } from "./authPairingTopic.js";
import { AuthRequest } from "./authRequest.js";
import { AuthKey } from "./authKey.js";

export class AuthStore {
  public authKeys: IAuth["authKeys"];
  public pairingTopics: IAuth["pairingTopics"];
  public requests: IAuth["requests"];

  constructor(
    public core: ICore,
    public logger: Logger,
  ) {
    this.authKeys = new AuthKey(this.core, this.logger);
    this.pairingTopics = new AuthPairingTopic(this.core, this.logger);
    this.requests = new AuthRequest(this.core, this.logger);
  }

  public async init() {
    await this.authKeys.init();
    await this.pairingTopics.init();
    await this.requests.init();
  }
}
