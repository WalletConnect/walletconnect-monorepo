import { FIVE_MINUTES } from "@walletconnect/time";
import { PairingTypes, RelayerTypes } from "@walletconnect/types";
import { calcExpiry } from "./misc";

export function formatCreatePairingPayload(
  topic: string,
  relay: RelayerTypes.ProtocolOptions,
): PairingTypes.Struct {
  const expiry = calcExpiry(FIVE_MINUTES);

  return {
    topic,
    relay,
    expiry,
    active: true,
  };
}
