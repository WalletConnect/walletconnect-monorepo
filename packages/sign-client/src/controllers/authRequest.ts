import { Store } from "@walletconnect/core";
import { Logger } from "@walletconnect/logger";
import { AuthTypes, ICore } from "@walletconnect/types";

import { AUTH_STORAGE_PREFIX, AUTH_REQUEST_CONTEXT } from "../constants";

export class AuthRequest extends Store<number, AuthTypes.PendingRequest> {
  constructor(public core: ICore, public logger: Logger) {
    super(
      core,
      logger,
      AUTH_REQUEST_CONTEXT,
      AUTH_STORAGE_PREFIX,
      (val: AuthTypes.PendingRequest) => val.id,
    );
  }
}
