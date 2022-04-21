import * as encoding from "@walletconnect/encoding";

export const IRIDIUM_MESSAGE_PREFIX = encoding.utf8ToArray("irn");
export const IRIDIUM_HEADER = {
  1: {
    LENGTH_SIZE: 4, // message length + padding
    TOTAL_SIZE: 8, // irn+version + LENGTH_SIZE
  },
}
