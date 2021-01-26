import * as React from 'react';
import { Text, TouchableOpacity } from 'react-native';

import { RenderQrcodeModalProps, WalletProvider } from '../types';

export default function QrcodeModal ({ visible, providers, connectToProvider }: RenderQrcodeModalProps): JSX.Element {
  if (visible) {
    return (
      <>
        {providers.map((provider: WalletProvider, key: number): JSX.Element => (
          <TouchableOpacity key={key} onPress={() => connectToProvider(provider)}>
            <Text key={key}>{provider.name}</Text>
          </TouchableOpacity>
        ))}
      </>
    );
  }
  return <React.Fragment />;
}
