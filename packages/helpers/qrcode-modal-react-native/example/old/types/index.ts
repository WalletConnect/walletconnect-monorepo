export enum ConnectorEvents {
  CONNECT = 'connect',
  CALL_REQUEST_SENT = 'call_request_sent',
  SESSION_UPDATE = 'session_update',
  DISCONNECT = 'disconnect',
}

export type WalletConnectProvider = {
  readonly name: string;
  readonly shortName: string;
  readonly color: string;
  readonly logo: string;
  readonly universalLink: string;
  readonly deepLink: string;
};

export type WalletConnectQrcodeModal = {
  readonly open: (uri: string, cb: unknown) => unknown;
  readonly close: () => unknown;
};

// eslint-disable-next-line functional/no-mixed-type
export type RenderQrcodeModalParams = {
  readonly setProvider: (provider: WalletConnectProvider) => Promise<void>;
  readonly providers: readonly WalletConnectProvider[];
};

export type QrcodeModalProps = RenderQrcodeModalParams & {
  readonly visible: boolean;
  readonly uri?: string;
  readonly redirectUrl?: string;
};
