export abstract class IPromises {
  public abstract cache: Map<
    number,
    {
      resolve: (value?: any) => void;
      reject: (reason?: any) => void;
      timeout: NodeJS.Timeout;
    }
  >;

  public abstract initiate<T>(id: number, timeout: number): Promise<T>;

  public abstract resolve<T>(id: number, data?: T): void;

  public abstract reject<T>(id: number, data?: T): void;
}
