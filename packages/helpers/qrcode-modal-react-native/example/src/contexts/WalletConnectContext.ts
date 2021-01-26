import registry from '@walletconnect/mobile-registry/registry.json';
import * as React from 'react';

import { WalletConnectContextValue, WalletProvider } from '../types';

const providers: readonly WalletProvider[] = registry.map(({
  logo,
  ...extras
}: WalletProvider): WalletProvider => Object.freeze({
  ...extras,
  logo:
    `https://github.com/WalletConnect/walletconnect-monorepo/tree/next/packages/helpers/mobile-registry${logo}`,
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
