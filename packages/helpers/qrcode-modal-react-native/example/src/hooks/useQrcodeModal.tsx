import * as React from 'react';
import useDeepCompareEffect from 'use-deep-compare-effect';

import { QrcodeModal } from '../components';
import { QrcodeModalProps, RenderQrcodeModalParams, WalletConnectQrcodeModal } from '../types';

// eslint-disable-next-line functional/no-mixed-type
export type useQrcodeModalInput = {
  readonly redirectUrl?: string;
  readonly renderQrcodeModal: (props: QrcodeModalProps) => JSX.Element;
};

// eslint-disable-next-line functional/no-mixed-type
export type useQrcodeModalResult = {
  readonly renderQrcodeModal: (params: RenderQrcodeModalParams) => JSX.Element;
  readonly qrcodeModal: WalletConnectQrcodeModal;
};

type State = {
  readonly uri?: string;
  readonly visible: boolean;
  readonly cb?: unknown;
};

const defaultRenderQrcodeModal = (props: QrcodeModalProps) => (
  <QrcodeModal {...props} />
);

export default function useQrcodeModal(input?: Partial<useQrcodeModalInput>): useQrcodeModalResult {
  const [state, setState] = React.useState<State>({
    uri: undefined,
    visible: false,
    cb: undefined,
  });
  const shouldSanitizeInput = React.useCallback((input?: Partial<useQrcodeModalInput>): useQrcodeModalInput => {
    return {
      renderQrcodeModal: defaultRenderQrcodeModal,
      ...(typeof input === 'object' ? input : {}),
    };
  }, []);

  const [sanitizedInput, setSanitizedInput] = React.useState<useQrcodeModalInput>(
    () => shouldSanitizeInput(input)
  );

  useDeepCompareEffect(() => {
    setSanitizedInput(shouldSanitizeInput(input));
  }, [setSanitizedInput, shouldSanitizeInput, input]);

  const renderQrcodeModal = React.useCallback(
    (params: RenderQrcodeModalParams): JSX.Element => {
      const { renderQrcodeModal, ...extraInputs } = sanitizedInput;
      return renderQrcodeModal({
        ...params,
        ...extraInputs,
        ...state,
      });
    },
    [sanitizedInput, state]
  );

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

  const qrcodeModal = React.useMemo((): WalletConnectQrcodeModal => ({
    open,
    close,
  }), [open, close]);

  return React.useMemo(() => ({
    renderQrcodeModal,
    qrcodeModal,
  }), [renderQrcodeModal, qrcodeModal]);
}