# WalletConnect for React Native

A drop-in library which helps easily connect your [**React Native**](https://reactnative.dev) dapps to [**Ethereum**](https://ethereum.org) Wallets on [**Android**](https://reactnative.dev), [**iOS**](https://reactnative.dev) and the [**Web**](https://github.com/necolas/react-native-web).

> **Notice:** This library assumes you have already enabled support for [**Web3**](https://github.com/ChainSafe/web3.js) inside your application. This can be done by creating a new project using [`npx create-react-native-dapp`](https://github.com/cawfree/create-react-native-dapp), or by introducing support for Web3 in an existing project by using [`rn-nodeify`](https://github.com/tradle/rn-nodeify).

For more details, check out the [documentation](https://docs.walletconnect.org).

## Installing

To get started, install [`@walletconnect/react-native`]:

```sh
yarn add @walletconnect/qrcode-modal-react-native
```

If you haven't already, you may also need to install [`react-native-svg`](https://github.com/react-native-svg/react-native-svg) and a persistent storage provider such as [`@react-native-async-storage/async-storage`](https://github.com/react-native-async-storage/async-storage):

```sh
yarn add react-native-svg @react-native-async-storage/async-storage
```

## Architecture

This library is implemented using the [**React Context API**](https://reactjs.org/docs/context.html), which is used to help make an instance of a [`connector`](https://docs.walletconnect.org/client-api) accessible globally throughout the application. This permits you to use a uniform instance within even deeply nested components without manually routing, and ensures your rendered application is synchronized with the connector state.

### `WalletConnectProvider`

At the root of your application, you can declare a [`WalletConnectProvider`](./src/providers/WalletConnectProvider.tsx) which controls access and persistence to a [**connector**](https://docs.walletconnect.org/client-api) instance:

```typescript
import * as React from 'react';
import WalletConnectProvider from '@walletconnect/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function App(): JSX.Element {
  return (
    <WalletConnectProvider
      redirectUrl={Platform.OS === 'web' ? window.location.origin : 'yourappscheme://'}
      storageOptions= {{
        asyncStorage AsyncStorage,
      }}>
      <>{/* awesome app here */}</>
    </WalletConnectProvider>
  );
}
```

Above, we pass the [`WalletConnectProvider`](./src/providers/WalletConnectProvider.tsx) two required parameters; `redirectUrl` and `storageOptions`:

  - The `redirectUrl` is used to help control navigation between external wallets and your application. On the `web`, you only need to specify a valid application route; whereas on mobile platforms, you must [**specify a deep link URI scheme**](https://docs.expo.io/workflow/linking/#universaldeep-links-without-a-custom-scheme).
  - The `storageOptions` prop allows you to specify the storage engine which must be used to persist session data.
    - Although in our examples we use [`@react-native-async-storage/async-storage`](https://github.com/react-native-async-storage/async-storage), this can be whatever engine you need which conforms to the [`IAsyncStorage`](https://github.com/pedrouid/keyvaluestorage) interface declaration.

Notably, the [`WalletConnectProvider`](./src/providers/WalletConnectProvider.tsx) also optionally accepts `WalletConnect` configuration arguments as defined by the [`IWalletConnectOptions`](https://github.com/WalletConnect/walletconnect-monorepo/tree/next/packages/helpers/utils) interface:

```typescript
import * as React from 'react';
import WalletConnectProvider from '@walletconnect/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function App(): JSX.Element {
  return (
    <WalletConnectProvider
      bridge="https://bridge.walletconnect.org"
      clientMeta={{
        description: 'Connect with WalletConnect',
        url: 'https://walletconnect.org',
        icons: ['https://walletconnect.org/walletconnect-logo.png'],
        name: 'WalletConnect',
      }}
      redirectUrl={Platform.OS === 'web' ? window.location.origin : 'yourappscheme://'}
      storageOptions= {{
        asyncStorage AsyncStorage,
      }}>
      <>{/* awesome app here */}</>
    </WalletConnectProvider>
  );
}
```

In the snippet above, aside from the required props, we can see the default configuration of the [`WalletConnectProvider`](./src/providers/WalletConnectProvider.tsx). Note that your custom options are merged deeply with this default configuration, therefore it's possible to override individual properties without having to define _all_ of them, e.g:

```typescript
import * as React from 'react';
import WalletConnectProvider from '@walletconnect/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function App(): JSX.Element {
  return (
    <WalletConnectProvider
      clientMeta={{ name: 'My Awesome Application!' }}
      redirectUrl={Platform.OS === 'web' ? window.location.origin : 'yourappscheme://'}
      storageOptions= {{
        asyncStorage AsyncStorage,
      }}>
      <>{/* even more awesome app here */}</>
    </WalletConnectProvider>
  );
}
```

#### `withWalletConnect`
Alternatively to manually using the [`WalletConnectProvider`](./src/providers/WalletConnectProvider.tsx), you can use the [`withWalletConnect`](./src/hooks/useWalletConnect.ts) higher order component which will wrap your root application in a [`WalletConnectProvider`](./src/providers/WalletConnectProvider.tsx) for you:

```typescript
import * as React from 'react';
import { withWalletConnect, useWalletConnect } from '@walletconnect/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

function App(): JSX.Element {
  const connector = useWalletConnect(); // valid
  return <>{/* awesome app here */}</>;
}

export default withWalletConnect(App, {
  clientMeta: {
    description: 'Connect with WalletConnect',
  },
  redirectUrl: Platform.OS === 'web' ? window.location.origin : 'yourappscheme://',
  storageOptions: {
    asyncStorage AsyncStorage,
  },
});
```

This is almost identical in functionality to the manual implementation of a [`WalletConnectProvider`](./src/providers/WalletConnectProvider.tsx), with the key difference that we're able to make a call to [`useWalletConnect`](./src/hooks/useWalletConnect.ts) directly from the `App` component. By contrast, in the previous example only child components of the [`WalletConnectProvider`](./src/providers/WalletConnectProvider.tsx) may be able to invoke this hook.

### `useWalletConnect`

The [`useWalletConnect`](./src/hooks/useWalletConnect.ts) hook provides access to a [`WalletConnect`](https://docs.walletconnect.org/client-api) `connector` instance which is accessible on Android, iOS and the Web. This conforms to the original specification:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useWalletConnect, withWalletConnect } from '@walletconnect/qrcode-modal-react-native';
import * as React from 'react';

function App(): JSX.Element {
  const connector = useWalletConnect();
  if (!connector.connected) {
    /**
     *  Connect! 🎉
     */
    return <Button title="Connect" onPress={() => connector.connect())} />;
  }
  return <Button title="Kill Session" onPress={() => connector.killSession()} />;
}

export default withWalletConnect(App, {
  redirectUrl: Platform.OS === 'web' ? window.location.origin : 'yourappscheme://',
  storageOptions: {
    asyncStorage AsyncStorage,
  },
});
```
