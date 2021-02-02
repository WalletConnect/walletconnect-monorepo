import * as React from "react";

import { WalletConnectContext } from "../contexts";
import { WalletConnectContextValue } from "../types";

export default function useWalletConnectContext(): Partial<WalletConnectContextValue> {
  return React.useContext(WalletConnectContext);
}
