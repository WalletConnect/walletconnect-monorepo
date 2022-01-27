export interface IridiumBaseMessage {
  version: number;
  message: string;
  opts?: any;
}

export interface IridiumV1MessageOptions {
  prompt?: boolean;
}

export interface IridiumV1Message extends IridiumBaseMessage {
  opts: IridiumV1MessageOptions;
}

export type IridiumMessage = IridiumBaseMessage | IridiumV1Message;
