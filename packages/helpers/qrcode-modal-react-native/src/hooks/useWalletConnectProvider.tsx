import * as React from 'react';
import { Linking, Platform } from 'react-native';

import { WalletConnectProvider } from '../types';

export type useWalletConnectProviderParams = {
  readonly redirectUrl: string | undefined;
};

export type useWalletConnectProviderResult = {
  readonly connect: (uri: string, provider: WalletConnectProvider) => Promise<boolean>;
};

export default function useWalletConnectProvider({
  redirectUrl,
}: useWalletConnectProviderParams): useWalletConnectProviderResult {
  const connect = React.useCallback(
    async (uri: string, provider: WalletConnectProvider): Promise<boolean> => {
      const { deepLink, universalLink } = provider;
      const maybeRedirectUrl =
        typeof redirectUrl === "string"
          ? `&redirectUrl=${encodeURIComponent(redirectUrl)}`
          : "";
      const url = `${Platform.OS === 'android' ? deepLink : universalLink}/wc?uri=${encodeURIComponent(
        uri
      )}${maybeRedirectUrl}`;
      Linking.openURL(url);
      return false;
    },
    [redirectUrl]
  );
  return { connect };
}
