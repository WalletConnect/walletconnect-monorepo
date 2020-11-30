export interface LegacySocketMessage {
  topic: string;
  type: string;
  payload: string;
  silent: boolean;
}
