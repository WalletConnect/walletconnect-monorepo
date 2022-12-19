import { Store } from "@walletconnect/core";
import { Logger } from "@walletconnect/logger";
import { ICore } from "@walletconnect/types";
import { Web3WalletTypes } from "../types";
import { CLIENT_STORAGE_PREFIX, REQUEST_CONTEXT } from "../constants";

export class PendingRequest extends Store<number, Web3WalletTypes.SessionRequest> {
  constructor(public core: ICore, public logger: Logger) {
    super(core, logger, REQUEST_CONTEXT, CLIENT_STORAGE_PREFIX);
  }
}
