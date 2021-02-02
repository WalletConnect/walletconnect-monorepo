import * as React from 'react';

import { WalletConnectProvider } from '../providers';
import { WalletConnectProviderProps } from '../types';

const withWalletConnectThunk = (
  Component: React.ElementType,
  options: Partial<WalletConnectProviderProps>
): React.ElementType => function WithWalletConnect(props): JSX.Element {
  return (
    <WalletConnectProvider {...(options || {})}>
      <Component {...props} />
    </WalletConnectProvider>
  );
};

export default withWalletConnectThunk;
