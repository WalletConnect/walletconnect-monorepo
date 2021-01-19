import deepmerge from 'deepmerge';
import * as React from 'react';

import QrcodeModal from '../components/QrcodeModal';
import type {
  RenderQrcodeModalDefinitionCallback,
  RenderQrcodeModalParams,
  useQrcodeModalParams,
  useQrcodeModalResult,
  WalletConnectQrcodeModal,
} from '../types';

import useWalletConnectProviders from './useWalletConnectProviders';

const defaultRenderQrcodeModal = (params: RenderQrcodeModalParams): JSX.Element => {
  return <QrcodeModal {...params} />;
};

const defaultQrcodeModalParams = Object.freeze({
  mobileRedirectUrl: undefined,
  renderQrcodeModal: defaultRenderQrcodeModal as RenderQrcodeModalDefinitionCallback,
}) as useQrcodeModalParams;

export default function useQrcodeModal(params?: Partial<useQrcodeModalParams>): useQrcodeModalResult {
  const [visible, setVisible] = React.useState<boolean>(false);
  const [uri, setUri] = React.useState<string>('');
  const [cb, setCb] = React.useState<any>();
  const { error, loading, data } = useWalletConnectProviders();
  const {
    redirectUrl: mobileRedirectUrl,
    renderQrcodeModal: renderQrcodeModalDefinition,
  } = React.useMemo((): useQrcodeModalParams => {
    if (!params || typeof params !== 'object') {
      return defaultQrcodeModalParams;
    }
    return deepmerge(defaultQrcodeModalParams, params);
  }, [params]);

  const open = React.useCallback((uri: string, cb: unknown): unknown => {
    setUri(uri);
    setVisible(true);
    setCb(() => cb);
    return undefined;
  }, [setVisible, setUri, setCb]);

  const close = React.useCallback((): unknown => {
    setVisible(false);
    if (typeof cb === 'function') {
      cb();
    }
    return undefined;
  }, [setVisible, cb]);

  const qrcodeModal = React.useMemo((): WalletConnectQrcodeModal => ({
    open,
    close,
  }), [open, close]);

  const requestDismiss = React.useMemo(() => close, [close]);

  const renderQrcodeModal = React.useCallback((): JSX.Element => renderQrcodeModalDefinition({
    visible,
    error,
    loading,
    data,
    requestDismiss,
    uri,
    mobileRedirectUrl,
  }), [visible, error, loading, data, requestDismiss, uri, mobileRedirectUrl]);

  return { qrcodeModal, renderQrcodeModal };
}
