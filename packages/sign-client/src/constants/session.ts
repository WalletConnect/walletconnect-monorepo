import { SEVEN_DAYS } from "@walletconnect/time";
import { calcExpiry } from "@walletconnect/utils";

export const SESSION_CONTEXT = "session";

export const SESSION_DEFAULT_TTL = SEVEN_DAYS;

export const SESSION_EXPIRY = calcExpiry(SESSION_DEFAULT_TTL);
