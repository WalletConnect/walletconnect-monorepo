import { calcExpiry } from "@walletconnect/utils";
import { THIRTY_DAYS } from "@walletconnect/time";

export const PROPOSAL_CONTEXT = "proposal";

export const PROPOSAL_EXPIRY = calcExpiry(THIRTY_DAYS);
