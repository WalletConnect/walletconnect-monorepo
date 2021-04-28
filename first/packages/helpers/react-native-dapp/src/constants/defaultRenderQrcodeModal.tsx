import * as React from 'react';

import { QrcodeModal } from '../components';
import { RenderQrcodeModalCallback, RenderQrcodeModalProps } from '../types';

const defaultRenderQrcodeModal: RenderQrcodeModalCallback = (
  props: RenderQrcodeModalProps
) => <QrcodeModal {...props} division={4} />;

export default defaultRenderQrcodeModal;
