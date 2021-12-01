import * as windowMetadata from "@walletconnect/window-metadata";

import { IClientMeta } from "@walletconnect/legacy-types";

export function getClientMeta(): IClientMeta | null {
  return windowMetadata.getWindowMetadata();
}
