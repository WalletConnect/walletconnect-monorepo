import WalletConnect from '@walletconnect/client';
import { IWalletConnectSession } from '@walletconnect/types';
import deepmerge from 'deepmerge';
import { KeyValueStorage, ReactNativeStorageOptions } from 'keyvaluestorage';
import * as React from 'react';
import { Linking, Platform } from 'react-native';
import useDeepCompareEffect from 'use-deep-compare-effect';

import { defaultRenderQrcodeModal, formatProviderUrl } from '../constants';
import { WalletConnectContext } from '../contexts';
import { useWalletConnectContext } from '../hooks';
import {
  ConnectorEvents,
  RenderQrcodeModalCallback,
  RenderQrcodeModalProps,
  WalletConnectContextValue,
  WalletConnectProviderProps,
  WalletProvider,
} from '../types';

type State = {
  readonly uri?: string;
  readonly visible: boolean;
  readonly cb?: unknown;
};

const defaultState: State = Object.freeze({
  visible: false,
});

export default function WalletConnectProvider({
  children,
  renderQrcodeModal: maybeRenderQrcodeModal,
  ...extras
}: Partial<WalletConnectProviderProps>): JSX.Element {
  const [state, setState] = React.useState<State>(defaultState);
  const parentContext = useWalletConnectContext();

  const intermediateValue = React.useMemo((): WalletConnectContextValue => deepmerge(
    parentContext,
    extras,
  ), [parentContext, extras]);

  const renderQrcodeModal = React.useMemo(() => (
    typeof maybeRenderQrcodeModal === 'function'
      ? maybeRenderQrcodeModal as RenderQrcodeModalCallback
      : defaultRenderQrcodeModal
  ), [maybeRenderQrcodeModal]);

  const open = React.useCallback((uri: string, cb: unknown): unknown => {
    setState({
      uri,
      visible: true,
      cb,
    });
    return undefined;
  }, [setState]);

  const close = React.useCallback((): unknown => {
    setState((currentState) => {
      const { cb } = currentState;
      setTimeout(() => typeof cb === 'function' && cb(), 0);
      return {
        uri: undefined,
        visible: false,
        cb: undefined,
      };
    });
    return undefined;
  }, [setState]);

  const qrcodeModal = React.useMemo(() => ({
    open,
    close,
  }), [open, close]);

  const { storageOptions, redirectUrl } = intermediateValue;

  const createStorage = React.useCallback((storageOptions: ReactNativeStorageOptions): KeyValueStorage => {
    return new KeyValueStorage(storageOptions);
  }, []);

  const [storage, setStorage] = React.useState(() => createStorage(storageOptions as ReactNativeStorageOptions));

  useDeepCompareEffect(() => {
    setStorage(createStorage(storageOptions as ReactNativeStorageOptions));
  }, [setStorage, storageOptions]);

  const sessionStorageKey = React.useMemo(
    () => `${storageOptions.rootStorageKey}:session`,
    [storageOptions],
  );

  const providerStorageKey = React.useMemo(
    () => `${storageOptions.rootStorageKey}:provider`,
    [storageOptions],
  );

  const connectToProvider = React.useCallback(async (provider: WalletProvider, uri?: string): Promise<void> => {
    if (typeof uri !== 'string' || !uri.length) {
      return Promise.reject(new Error('Invalid uri.'));
    }
    const maybeRedirectUrl =
      typeof redirectUrl === "string"
        ? `&redirectUrl=${encodeURIComponent(redirectUrl)}`
        : "";
    const connectionUrl = `${formatProviderUrl(provider)}/wc?uri=${encodeURIComponent(
      uri
    )}${maybeRedirectUrl}`;

    if (await Linking.canOpenURL(connectionUrl)) {
      return Promise.all([
        storage.setItem(providerStorageKey, provider),
        Linking.openURL(connectionUrl),
      ]) && undefined;
    }
    return Promise.reject(new Error('Unable to open url.'));
  }, [providerStorageKey, storage, redirectUrl, state]);

  const [connector, setConnector] = React.useState<WalletConnect | undefined>();

  const createConnector = React.useCallback(
    async function shouldCreateConnector(params: WalletConnectContextValue): Promise<WalletConnect> {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { storageOptions: _storageOptions, ...extras } = params;
      const [
        maybeExistingSession,
        maybeExistingProvider,
      ] = await Promise.all([
        await storage.getItem(sessionStorageKey),
        await storage.getItem(providerStorageKey),
      ]);
  
      const isResumable = !!maybeExistingSession && !!maybeExistingProvider;
  
      if (!isResumable) {
        await Promise.all([
          storage.removeItem(sessionStorageKey),
          storage.removeItem(providerStorageKey),
        ]);
      }
  
      const nextConnector = new WalletConnect({
        session: isResumable ? maybeExistingSession as IWalletConnectSession : undefined,
        qrcodeModal,
        ...extras,
      });
  
      const maybeThrowError = (error?: unknown) => {
        if (error) {
          // eslint-disable-next-line functional/no-throw-statement
          throw error;
        }
      };
  
      nextConnector.on(ConnectorEvents.CONNECT, async (error: unknown) => {
        maybeThrowError(error);
        await storage.setItem(sessionStorageKey, nextConnector.session);
      });
    
      nextConnector.on(ConnectorEvents.CALL_REQUEST_SENT, async (error: unknown) => {
        maybeThrowError(error);
        if (Platform.OS !== 'web') {
          const provider: WalletProvider | undefined = await storage.getItem(providerStorageKey);
  
          if (!provider) {
            return maybeThrowError(new Error('Provider not found.'));
          }
  
          const url = formatProviderUrl(provider);
          return Linking.canOpenURL(url) && Linking.openURL(url);
        }
      });
    
      nextConnector.on(ConnectorEvents.SESSION_UPDATE, async (error: unknown) => {
        maybeThrowError(error);
        await storage.setItem(sessionStorageKey, nextConnector.session);
      });
  
      nextConnector.on(ConnectorEvents.DISCONNECT, async (error: unknown) => {
        maybeThrowError(error);
        await Promise.all([
          storage.setItem(sessionStorageKey, undefined),
          storage.setItem(providerStorageKey, undefined),
        ]);

        setConnector(await shouldCreateConnector(params)); /* wc_repeat */
      });
  
      return nextConnector;
    },
    [
      sessionStorageKey,
      providerStorageKey,
      storage,
      qrcodeModal,
      setConnector,
    ],
  );

  useDeepCompareEffect(() => {
    (async () => {
      setConnector(await createConnector(intermediateValue));
    })();
  }, [setConnector, createConnector, intermediateValue]);

  const onDismiss = React.useCallback(() => {
    close();
    (async () => {
      setConnector(await createConnector(intermediateValue));
    })();
  }, [close, setConnector, createConnector, intermediateValue]);

  const modalProps = React.useMemo((): RenderQrcodeModalProps => ({
    connectToProvider,
    visible: state.visible,
    providers: intermediateValue.providers,
    uri: state.uri,
    onDismiss,
  }), [
    state.visible,
    connectToProvider,
    intermediateValue,
    state.uri,
    onDismiss,
  ]);

  const value = React.useMemo((): WalletConnectContextValue => ({
    ...intermediateValue,
    connectToProvider,
    connector,
  }), [intermediateValue, connectToProvider, connector]);

  return (
    <WalletConnectContext.Provider value={value}>
      {!!children && children}
      {renderQrcodeModal(modalProps)}
    </WalletConnectContext.Provider>
  );
}
