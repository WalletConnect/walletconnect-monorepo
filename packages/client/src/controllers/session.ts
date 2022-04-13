import { IClient, SessionTypes } from "@walletconnect/types";
import { hasOverlap } from "@walletconnect/utils";
import { Logger } from "pino";
import { SESSION_CONTEXT } from "../constants";
import { Store } from "./store";

export class Session extends Store<SessionTypes.Struct> {
  constructor(public client: IClient, public logger: Logger) {
    super(client, logger, SESSION_CONTEXT);
  }

  // TODO(ilja) address permission flattening
  public find(permissions: Partial<SessionTypes.Permissions>): SessionTypes.Struct[] {
    return this.values.filter(session => {
      let isCompatible = false;
      if (
        session.permissions?.jsonrpc &&
        permissions.jsonrpc?.methods &&
        hasOverlap(permissions.jsonrpc.methods, session.permissions.jsonrpc.methods)
      ) {
        isCompatible = true;
      }
      if (
        session.permissions?.blockchain &&
        permissions.blockchain?.chains &&
        hasOverlap(permissions.blockchain.chains, session.permissions.blockchain.chains)
      ) {
        isCompatible = true;
      }
      if (
        session.permissions?.notifications &&
        permissions.notifications?.types &&
        hasOverlap(permissions.notifications.types, session.permissions.notifications.types)
      ) {
        isCompatible = true;
      }
      return isCompatible;
    });
  }
}
