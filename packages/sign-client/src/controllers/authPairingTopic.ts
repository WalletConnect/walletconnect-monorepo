import { Store } from "@walletconnect/core";
import { Logger } from "@walletconnect/logger";
import { ICore } from "@walletconnect/types";

import { AUTH_KEYS_CONTEXT, AUTH_PAIRING_TOPIC_CONTEXT } from "../constants";

export class AuthPairingTopic extends Store<string, { topic: string; pairingTopic: string }> {
  constructor(public core: ICore, public logger: Logger) {
    super(core, logger, AUTH_KEYS_CONTEXT, AUTH_PAIRING_TOPIC_CONTEXT);
  }
}
