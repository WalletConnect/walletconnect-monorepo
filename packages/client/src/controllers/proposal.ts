import { IClient, ProposalTypes } from "@walletconnect/types";
import { Logger } from "pino";
import { PROPOSAL_CONTEXT } from "../constants";
import { Store } from "./store";

export class Proposal extends Store<number, ProposalTypes.Struct> {
  constructor(public client: IClient, public logger: Logger) {
    super(client, logger, PROPOSAL_CONTEXT);
  }
}
