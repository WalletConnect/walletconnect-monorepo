import WalletConnect from '@walletconnect/client';
import { IWalletConnectOptions } from '@walletconnect/types';
import deepmerge from 'deepmerge';
import KeyValueStorage, { ReactNativeStorageOptions } from 'keyvaluestorage';
import * as React from 'react';
import { Linking, Platform } from 'react-native';
import useDeepCompareEffect from 'use-deep-compare-effect';

import { formatProviderUrl } from '../constants';
import { ConnectorEvents, WalletConnectProvider } from '../types';

import useProviders from './useProviders';

// eslint-disable-next-line functional/no-mixed-type
type State = {
  readonly connector: WalletConnect | null;
  readonly setProvider: (provider: WalletConnectProvider) => Promise<void> | null;
};

type WalletConnectStorageOptions = ReactNativeStorageOptions & {
  readonly rootStorageKey?: string;
};

export type useWalletConnectParams = IWalletConnectOptions & {
  readonly storageOptions?: Partial<WalletConnectStorageOptions>;
};

export type useWalletConnectResult = State & {
  readonly providers: readonly WalletConnectProvider[];
};

export const defaultParams: useWalletConnectParams = Object.freeze({
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
});

const initialState: State = Object.freeze({
  connector: null,
  setProvider: () => Promise.reject(new Error('Not yet ready.')),
});

export default function useWalletConnect(params: useWalletConnectParams): useWalletConnectResult {
  const providers = useProviders();
  const maybeThrowError = React.useCallback((error?: Error): undefined => {
    !!error && (() => {
      // eslint-disable-next-line functional/no-throw-statement
      throw error;
    })();
    return undefined;
  }, []);

  const [state, setState] = React.useState<State>(initialState);

  const createState = React.useCallback(
    async function shouldCreateState(maybeParams: useWalletConnectParams): Promise<State> {
      const {
        storageOptions: { rootStorageKey, ...storageOptions },
        ...extras
      } = deepmerge(defaultParams, maybeParams || {});

      const storage = new KeyValueStorage(storageOptions);
      const sessionStorageKey = `${rootStorageKey}:session`;
      const providerStorageKey = `${rootStorageKey}:provider`;

      const maybeExistingProvider = await storage.getItem(providerStorageKey);
      const maybeExistingSession = await storage.getItem(sessionStorageKey);

      const isResumable = !!maybeExistingSession && !!maybeExistingProvider;

      const connector = new WalletConnect(
        {
          session: isResumable ? maybeExistingSession : undefined,
          ...extras,
        }
      );
  
      connector.on(ConnectorEvents.CONNECT, async (error) => {
        maybeThrowError(error);
        await storage.setItem(sessionStorageKey, connector.session);
      });
  
      connector.on(ConnectorEvents.CALL_REQUEST_SENT, async (error) => {
        maybeThrowError(error);
        if (Platform.OS !== 'web') {
          const provider: WalletConnectProvider | undefined = await storage.getItem(providerStorageKey);

          if (!provider) {
            maybeThrowError(new Error('Provider not found.'));
          }

          const url = formatProviderUrl(provider);
          return Linking.canOpenURL(url) && Linking.openURL(url);
        }
      });
  
      connector.on(ConnectorEvents.SESSION_UPDATE, async (error) => {
        maybeThrowError(error);
        await storage.setItem(sessionStorageKey, connector.session);
      });
  
      connector.on(ConnectorEvents.DISCONNECT, async (error) => {
        maybeThrowError(error);
        await Promise.all([
          storage.setItem(sessionStorageKey, undefined),
          storage.setItem(providerStorageKey, undefined),
        ]);
        setState(await shouldCreateState(maybeParams));
      });

      const setProvider = async (provider: WalletConnectProvider): Promise<void> => {
        return storage.setItem(providerStorageKey, provider);
      };
  
      return { connector, setProvider };
    },
    [maybeThrowError, setState]
  );

  useDeepCompareEffect(() => {
    (async () =>
      setState(await createState(params))
    )();
    return;
  }, [params, setState, createState]);

  return React.useMemo((): useWalletConnectResult => ({
    ...state,
    providers,
  }), [state, providers]);
}