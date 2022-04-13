import { IClient, PairingTypes } from "@walletconnect/types";
import { Logger } from "pino";
import { PROPOSAL_CONTEXT } from "../constants";
import { Store } from "./store";

export class Proposal extends Store<PairingTypes.Struct> {
  constructor(public client: IClient, public logger: Logger) {
    super(client, logger, PROPOSAL_CONTEXT);
  }
}
