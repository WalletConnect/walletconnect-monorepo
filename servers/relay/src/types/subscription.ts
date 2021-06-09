export interface Subscription {
  id: string;
  topic: string;
  socketId: string;
  legacy?: boolean;
}
