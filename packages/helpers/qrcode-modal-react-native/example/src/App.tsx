import AsyncStorage from '@react-native-async-storage/async-storage';
import { IAsyncStorage } from 'keyvaluestorage/dist/cjs/react-native/types';
import * as React from 'react';
import { Platform, Text, TouchableOpacity } from 'react-native';

import { expo } from '../app.json';

import { withWalletConnect } from './hoc';
import { useWalletConnect } from './hooks';

function App(): JSX.Element {
  const connector = useWalletConnect();
  const connect = React.useCallback(async () => {
    try {
      await connector.connect();
    } catch (e) {
      console.error(e);
    }
  }, [connector]);
  const killSession = React.useCallback(async () => {
    try {
      await connector.killSession();
    } catch (e) {
      console.error(e);
    }
  }, [connector]);
  return (
    <>
      {!connector.connected ? (
        <TouchableOpacity onPress={connect}>
          <Text>Connect</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity onPress={killSession}>
          <Text>Kill Session</Text>
        </TouchableOpacity>
      )}
    </>
  );
}

const { scheme } = expo;

export default withWalletConnect(App, {
  redirectUrl: Platform.OS === 'web' ? window.location.origin : `${scheme}://`,
  storageOptions: {
    asyncStorage: AsyncStorage as unknown as IAsyncStorage<string, unknown>,
  },
});
