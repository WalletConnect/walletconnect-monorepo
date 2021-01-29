import AsyncStorage from '@react-native-async-storage/async-storage';
import { useWalletConnect, withWalletConnect } from '@walletconnect/react-native-dapp';
import { IAsyncStorage } from 'keyvaluestorage/dist/cjs/react-native/types';
import * as React from 'react';
import { Button, Platform, SafeAreaView, StyleSheet, View } from 'react-native';

import { expo } from '../app.json';

function App(): JSX.Element {
  const connector = useWalletConnect();
  return (
    <View style={StyleSheet.absoluteFill}>
      <SafeAreaView />
      {!connector.connected ? (
        <Button title="Connect" onPress={() => connector.connect()} />
      ) : (
        <Button title="Kill Session" onPress={() => connector.killSession()} />
      )}
    </View>
  );
}

const { scheme } = expo;

export default withWalletConnect(App, {
  redirectUrl: Platform.OS === 'web' ? window.location.origin : `${scheme}://`,
  storageOptions: {
    asyncStorage: AsyncStorage as unknown as IAsyncStorage,
  },
});