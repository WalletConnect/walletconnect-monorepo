import * as React from 'react';
import { Linking } from 'react-native';

import { formatProviderUrl } from '../constants';
import { WalletConnectProvider } from '../types';

export type useProviderParams = {
  readonly redirectUrl?: string;
};

export type useProviderResult = {
  readonly connect: (provider: WalletConnectProvider, uri?: string) => Promise<void>;
};

export default function useProvider(params: useProviderParams): useProviderResult {
  const connect = React.useCallback(async (provider: WalletConnectProvider, uri?: string): Promise<void> => {
    if (typeof uri !== 'string' || !uri.length) {
      return Promise.reject(new Error('Invalid uri.'));
    }

    const { redirectUrl } = params;
    const maybeRedirectUrl =
      typeof redirectUrl === "string"
        ? `&redirectUrl=${encodeURIComponent(redirectUrl)}`
        : "";
    const connectionUrl = `${formatProviderUrl(provider)}/wc?uri=${encodeURIComponent(
      uri
    )}${maybeRedirectUrl}`;

    if (await Linking.canOpenURL(connectionUrl)) {
      return Linking.openURL(connectionUrl);
    }
    return Promise.reject(new Error('Unable to open url.'));
  }, [params]);
  return { connect };
}
