export type Stateful<T> = {
  readonly error: Error | undefined;
  readonly loading: boolean;
  readonly data: T;
};

export type RenderQrcodeModalInlineCallback = () => JSX.Element;

export type WalletConnectQrcodeModal = {
  readonly open: (uri: string, cb: unknown) => unknown;
  readonly close: () => unknown;
};

export type WalletConnectProvider = {
  readonly name: string;
  readonly shortName: string;
  readonly color: string;
  readonly logo: string;
  readonly universalLink: string;
  readonly deepLink: string;
};

export type WalletConnectProviders = readonly WalletConnectProvider[];

export type StatefulWalletConnectProviders = Stateful<WalletConnectProviders>;

export type useOpenSourceRegistryResult = {
  readonly error: Error | undefined;
  readonly loading: boolean;
  readonly data: WalletConnectProviders;
};

export type RenderQrcodeModalParams = StatefulWalletConnectProviders & {
  readonly uri: string;
  readonly visible: boolean;
  readonly mobileRedirectUrl?: string;
  readonly requestDismiss: () => unknown;
};

export type RenderQrcodeModalDefinitionCallback = (
  params: RenderQrcodeModalParams
) => JSX.Element;

export type useQrcodeModalParams = {
  readonly redirectUrl?: string;
  readonly renderQrcodeModal: RenderQrcodeModalDefinitionCallback;
};

export type useQrcodeModalResult = {
  readonly qrcodeModal: WalletConnectQrcodeModal;
  readonly renderQrcodeModal: RenderQrcodeModalInlineCallback;
};
