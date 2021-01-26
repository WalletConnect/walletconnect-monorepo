import registry from '@walletconnect/mobile-registry/registry.json';
import * as React from 'react';

import { WalletConnectProvider } from '../types';

export default function useProviders(): readonly WalletConnectProvider[] {
  return React.useMemo((): readonly WalletConnectProvider[] => {
    return registry.map(({
      logo,
      ...extras
    }: WalletConnectProvider): WalletConnectProvider => Object.freeze({
      ...extras,
      logo:
        `https://github.com/WalletConnect/walletconnect-monorepo/tree/next/packages/helpers/mobile-registry${logo}`,
    }));
  }, []);
}
