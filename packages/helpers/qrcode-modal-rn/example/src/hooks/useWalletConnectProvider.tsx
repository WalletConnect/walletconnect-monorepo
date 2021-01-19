import * as React from 'react';
import { Linking } from 'react-native';

import { WalletConnectProvider } from '../types';

export type useWalletConnectProviderParams = {
  readonly redirectUrl: string;
};

export type useWalletConnectProviderResult = {
  readonly connect: (uri: string, provider: WalletConnectProvider) => Promise<boolean>;
};

export default function useWalletConnectProvider({
  redirectUrl,
}: useWalletConnectProviderParams): useWalletConnectProviderResult {
  const connect = React.useCallback(
    async (uri: string, provider: WalletConnectProvider): Promise<boolean> => {
      const { universalLink } = provider;
      const maybeRedirectUrl =
        typeof redirectUrl === "string"
          ? `&redirectUrl=${encodeURIComponent(redirectUrl)}`
          : "";
      const url = `${universalLink}/wc?uri=${encodeURIComponent(
        uri
      )}${maybeRedirectUrl}`;
      Linking.openURL(url);
      return false;
    },
    [redirectUrl]
  );
  return { connect };
}
