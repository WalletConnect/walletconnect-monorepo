import { Store } from "@walletconnect/core";
import { Logger } from "@walletconnect/logger";
import { ICore } from "@walletconnect/types";

import { AUTH_KEYS_CONTEXT, AUTH_STORAGE_PREFIX, AUTH_PUBLIC_KEY_NAME } from "../constants";

export class AuthKey extends Store<string, { responseTopic: string; publicKey: string }> {
  constructor(public core: ICore, public logger: Logger) {
    super(core, logger, AUTH_KEYS_CONTEXT, AUTH_STORAGE_PREFIX, () => AUTH_PUBLIC_KEY_NAME);
  }
}
