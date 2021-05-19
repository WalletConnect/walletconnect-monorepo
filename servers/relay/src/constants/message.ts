import { THIRTY_SECONDS } from "./time";

export const MESSAGE_CONTEXT = "message";

export const MESSAGE_EVENTS = {
  added: "message_added",
  removed: "message_removed",
};

export const MESSAGE_RETRIAL_TIMEOUT = THIRTY_SECONDS * 1000;

export const MESSAGE_RETRIAL_MAX = 3;
