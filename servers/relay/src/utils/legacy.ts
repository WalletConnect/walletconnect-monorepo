import { LegacySocketMessage } from "../types";

export function isLegacySocketMessage(payload: any): payload is LegacySocketMessage {
  return "topic" in payload && "type" in payload && "payload" in payload;
}
