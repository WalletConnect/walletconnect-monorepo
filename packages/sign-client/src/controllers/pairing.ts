import { Logger } from "pino";
import { Store } from "@walletconnect/core";
import { ICore, PairingTypes } from "@walletconnect/types";

import { SIGN_CLIENT_STORAGE_PREFIX, PAIRING_CONTEXT } from "../constants";

export class Pairing extends Store<string, PairingTypes.Struct> {
  constructor(public core: ICore, public logger: Logger) {
    super(core, logger, PAIRING_CONTEXT, SIGN_CLIENT_STORAGE_PREFIX);
  }
}
