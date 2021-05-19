import { FIVE_SECONDS } from "./time";

export const SERVER_CONTEXT = "server";

export const SERVER_EVENTS = {
  beat: "server_beat",
};

export const SERVER_BEAT_INTERVAL = FIVE_SECONDS * 1000;
