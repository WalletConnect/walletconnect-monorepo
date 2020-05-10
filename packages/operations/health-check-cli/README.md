Provides a health check script for WalletConnect.

* Check the bridge health from CLI

* A standalone web page where you can direct web browser and mobile users to check if their device works with WalletConnect bridge

# Setting up

While ``next`` has not been released.

```sh
npm install
```

# Running form the command line

Run:

```sh
npm run health-check
```

# Internals

How WalletConnect events go

1. Originator (dApp) creates a new WalletConnect session
  - Session initiated with `connect()`
  - This results to an session id, which is transported as URI. The same URI is displayed in a QR code
2. Joiner (wallet) connects to the session
  - URI passed to WalletConnect constructor
  - Session accepted with `createSession()`
3. Originator (dApp) will receive `connect` callback
  - Originator replies with `ping`
4. Joiner (wallet) receives `ping`
  - Call it a working setup and calculate time how long it took


