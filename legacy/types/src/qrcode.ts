export interface IQRCodeModal {
  open(uri: string, cb: any, opts?: any): void;
  close(): void;
}

export interface IQRCodeModalOptions {
  registryUrl?: string;
  mobileLinks?: string[];
  desktopLinks?: string[];
}
