import registry from '@walletconnect/mobile-registry/registry.json';
import * as React from 'react';
import { Platform } from 'react-native';

import { WalletConnectContextValue, WalletProvider } from '../types';

const providers: readonly WalletProvider[] = registry
  .filter(({ universalLink, deepLink }) => {
    /* wc_mobile_valid */
    if (Platform.OS === 'ios') {
      return typeof universalLink === 'string' && !!universalLink.length;
    } else if (Platform.OS === 'android') {
      return typeof deepLink === 'string' && !!deepLink.length;
    }
    return Platform.OS === 'web';
  })
  .map(({
    logo,
    ...extras
  }: WalletProvider): WalletProvider => Object.freeze({
    ...extras,
    logo:
      `https://github.com/WalletConnect/walletconnect-monorepo/raw/next/packages/helpers/mobile-registry${
        logo.substring(1)
      }`,
  }));

const defaultValue: Partial<WalletConnectContextValue> = Object.freeze({
  bridge: 'https://bridge.walletconnect.org',
  clientMeta: {
    description: 'Connect with WalletConnect',
    url: 'https://walletconnect.org',
    icons: ['https://walletconnect.org/walletconnect-logo.png'],
    name: 'WalletConnect',
  },
  storageOptions: {
    rootStorageKey: '@walletconnect/qrcode-modal-react-native',
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  connectToProvider: async (provider: WalletProvider, uri?: string) => Promise.reject(new Error(
    '[WalletConnect]: It looks like you have forgotten to wrap your application with a <WalletConnectProvider />.',
  )),
  providers,
});

export default React.createContext<Partial<WalletConnectContextValue>>(
  defaultValue,
);
