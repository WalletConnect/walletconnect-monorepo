import { IClient, PairingTypes } from "@walletconnect/types";
import { Logger } from "pino";
import { PAIRING_CONTEXT } from "../constants";
import { Store } from "./store";

export class Pairing extends Store<PairingTypes.Struct> {
  constructor(public client: IClient, public logger: Logger) {
    super(client, logger, PAIRING_CONTEXT);
  }
}
