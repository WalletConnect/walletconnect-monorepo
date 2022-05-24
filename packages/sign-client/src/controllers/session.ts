import { Logger } from "pino";
import { Store } from "@walletconnect/core";
import { ICore, SessionTypes } from "@walletconnect/types";

import { SIGN_CLIENT_STORAGE_PREFIX, SESSION_CONTEXT } from "../constants";

export class Session extends Store<string, SessionTypes.Struct> {
  constructor(public core: ICore, public logger: Logger) {
    super(core, logger, SESSION_CONTEXT, SIGN_CLIENT_STORAGE_PREFIX);
  }
}
