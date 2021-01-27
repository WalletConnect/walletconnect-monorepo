# WalletConnect for React Native

A drop-in library which helps easily connect your [**React Native**]() dapps to [**Ethereum**]() Wallets on [**Android**], [**iOS**]() and the [**Web**]().

> **Notice:** This library assumes you have already enabled support for [**Web3**]() inside your application. This can be done by creating a new project using [`npx create-react-native-dapp`](https://github.com/cawfree/create-react-native-dapp), or by introducing support for Web3 in an existing project by using [`rn-nodeify`]().

For more details, check out the [documentation](https://docs.walletconnect.org).

## Installing

To get started, install `@walletconnect/qrcode-modal-react-native`:

```sh
yarn add @walletconnect/qrcode-modal-react-native
```

If you haven't already, you may also need to install [`react-native-svg`]() and a persistent storage provider such as [`@react-native-async-storage/async-storage`]():

```sh
yarn add react-native-svg @react-native-async-storage/async-storage
```

## Architecture

This library is implemented using the [**React Context API**](), which is used to help make an instance of a [`connector`]() accessible globally throughout the application. This permits you to use a uniform instance within even deeply nested components without manually routing, and ensures your rendered application is synchronized with the connector state.

### `WalletConnectProvider`

At the root of your application, you can declare a [`WalletConnectProvider`]() which controls access and persistence to a [**connector**]() instance:

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

Above, we pass the [`WalletConnectProvider`]() two required parameters; `redirectUrl` and `storageOptions`:

  - The `redirectUrl` is used to help control navigation between external wallets and your application. On the `web`, you only need to specify a valid application route; whereas on mobile platforms, you must [**specify a deep link URI scheme**]().
  - The `storageOptions` prop allows you to specify the storage engine which must be used to persist session data.
    - Although in our examples we use [`@react-native-async-storage/async-storage`](), this can be whatever engine you need which conforms to the [`IAsyncStorage`]() interface declaration.

Notably, the [`WalletConnectProvider`]() also optionally accepts `WalletConnect` configuration arguments as defined by the [`IWalletConnectOptions`]() interface:

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

In the snippet above, aside from the required props, we can see the default configuration of the [`WalletConnectProvider`](). Note that your custom options are merged deeply with this default configuration, therefore it's possible to override individual properties without having to define _all_ of them, e.g:

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
Alternatively to manually using the [`WalletConnectProvider`](), you can use the [`withWalletConnect`]() higher order component which will wrap your root application in a [`WalletConnectProvider`]() for you:

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

This is almost identical in functionality to the manual implementation of a [`WalletConnectProvider`](), with the key difference that we're able to make a call to [`useWalletConnect`]() directly from the `App` component. By contrast, in the previous example only child components of the [`WalletConnectProvider`]() may be able to invoke this hook.

### `useWalletConnect`

The [`useWalletConnect`]() hook provides access to a [`WalletConnect`]() `connector` instance which is accessible on Android, iOS and the Web. This conforms to the original specification:

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
