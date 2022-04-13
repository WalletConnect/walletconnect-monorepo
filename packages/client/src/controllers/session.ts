import { IClient, SessionTypes } from "@walletconnect/types";
import { isSessionCompatible } from "@walletconnect/utils";
import { Logger } from "pino";
import { SESSION_CONTEXT } from "../constants";
import { Store } from "./store";

export class Session extends Store<SessionTypes.Struct> {
  constructor(public client: IClient, public logger: Logger) {
    super(client, logger, SESSION_CONTEXT);
  }

  public find(filters: SessionTypes.Filters): SessionTypes.Struct[] {
    return this.values.filter((session: SessionTypes.Struct) =>
      isSessionCompatible(session, filters),
    );
  }
}
