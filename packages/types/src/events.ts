export abstract class IEvents {
  public abstract on(event: string, listener: any): void;
  public abstract once(event: string, listener: any): void;
  public abstract off(event: string, listener: any): void;
  public abstract removeListener(event: string, listener: any): void;
}

export interface IInternalEvent {
  event: string;
  params: any;
}

export interface IEventEmitter {
  event: string;
  callback: (error: Error | null, request: any | null) => void;
}

export type IErrorCallback = (err: Error | null, data?: any) => void;

export type ICallback = () => void;

export interface IError extends Error {
  res?: any;
  code?: any;
}
