import WalletConnect from '@walletconnect/client';
import { IWalletConnectSession } from '@walletconnect/types';
import deepmerge from 'deepmerge';
import { KeyValueStorage, ReactNativeStorageOptions } from 'keyvaluestorage';
import * as React from 'react';
import { Linking, Platform } from 'react-native';
import useDeepCompareEffect from 'use-deep-compare-effect';

import { defaultRenderQrcodeModal, formatWalletServiceUrl } from '../constants';
import { WalletConnectContext } from '../contexts';
import { useWalletConnectContext } from '../hooks';
import {
  ConnectorEvents,
  RenderQrcodeModalCallback,
  RenderQrcodeModalProps,
  WalletConnectContextValue,
  WalletConnectProviderProps,
  WalletService,
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

  const walletServiceStorageKey = React.useMemo(
    () => `${storageOptions.rootStorageKey}:walletService`,
    [storageOptions],
  );

  const connectToWalletService = React.useCallback(async (walletService: WalletService, uri?: string): Promise<void> => {
    if (typeof uri !== 'string' || !uri.length) {
      return Promise.reject(new Error('Invalid uri.'));
    }
    const maybeRedirectUrl =
      typeof redirectUrl === "string"
        ? `&redirectUrl=${encodeURIComponent(redirectUrl)}`
        : "";
    const connectionUrl = `${formatWalletServiceUrl(walletService)}/wc?uri=${encodeURIComponent(
      uri
    )}${maybeRedirectUrl}`;

    if (await Linking.canOpenURL(connectionUrl)) {
      return Promise.all([
        storage.setItem(walletServiceStorageKey, walletService),
        Linking.openURL(connectionUrl),
      ]) && undefined;
    }
    return Promise.reject(new Error('Unable to open url.'));
  }, [walletServiceStorageKey, storage, redirectUrl, state]);

  const [connector, setConnector] = React.useState<WalletConnect | undefined>();

  const createConnector = React.useCallback(
    async function shouldCreateConnector(params: WalletConnectContextValue): Promise<WalletConnect> {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { storageOptions: _storageOptions, ...extras } = params;
      const [
        maybeExistingSession,
        maybeExistingWalletService,
      ] = await Promise.all([
        await storage.getItem(sessionStorageKey),
        await storage.getItem(walletServiceStorageKey),
      ]);
  
      const isResumable = !!maybeExistingSession && !!maybeExistingWalletService;
  
      if (!isResumable) {
        await Promise.all([
          storage.removeItem(sessionStorageKey),
          storage.removeItem(walletServiceStorageKey),
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
          const walletService: WalletService | undefined = await storage.getItem(walletServiceStorageKey);
  
          if (!walletService) {
            return maybeThrowError(new Error('Cached WalletService not found.'));
          }
  
          const url = formatWalletServiceUrl(walletService);
          return (await Linking.canOpenURL(url)) && Linking.openURL(url);
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
          storage.setItem(walletServiceStorageKey, undefined),
        ]);

        setConnector(await shouldCreateConnector(params)); /* wc_repeat */
      });
  
      return nextConnector;
    },
    [
      sessionStorageKey,
      walletServiceStorageKey,
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
    connectToWalletService,
    visible: state.visible,
    walletServices: intermediateValue.walletServices,
    uri: state.uri,
    onDismiss,
  }), [
    state.visible,
    connectToWalletService,
    intermediateValue,
    state.uri,
    onDismiss,
  ]);

  const value = React.useMemo((): WalletConnectContextValue => ({
    ...intermediateValue,
    connectToWalletService,
    connector,
  }), [intermediateValue, connectToWalletService, connector]);

  return (
    <WalletConnectContext.Provider value={value}>
      {!!children && children}
      {renderQrcodeModal(modalProps)}
    </WalletConnectContext.Provider>
  );
}
