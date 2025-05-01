# @walletconnect/signer-connection

## 2.20.2

### Patch Changes

- [#6279](https://github.com/WalletConnect/walletconnect-monorepo/pull/6279) [`f2847e2511243846a422ec0495f9d56a88376a1c`](https://github.com/WalletConnect/walletconnect-monorepo/commit/f2847e2511243846a422ec0495f9d56a88376a1c) Thanks [@ganchoradkov](https://github.com/ganchoradkov)! - fixed auto bumping relayer version on release

- Updated dependencies [[`f2847e2511243846a422ec0495f9d56a88376a1c`](https://github.com/WalletConnect/walletconnect-monorepo/commit/f2847e2511243846a422ec0495f9d56a88376a1c)]:
  - @walletconnect/sign-client@2.20.2
  - @walletconnect/types@2.20.2
  - @walletconnect/utils@2.20.2

## 2.20.1

### Patch Changes

- [#6277](https://github.com/WalletConnect/walletconnect-monorepo/pull/6277) [`baac2ac8ff62d1e98596440dd86bcefadf771b4d`](https://github.com/WalletConnect/walletconnect-monorepo/commit/baac2ac8ff62d1e98596440dd86bcefadf771b4d) Thanks [@ganchoradkov](https://github.com/ganchoradkov)! - fixed a bug where calling `subscriber.onDisable` multiple times was overriding the `cached` subscriptions with an empty array

- [#6275](https://github.com/WalletConnect/walletconnect-monorepo/pull/6275) [`c1d656f4bbbec09914ecbc9af959f5933ae6f292`](https://github.com/WalletConnect/walletconnect-monorepo/commit/c1d656f4bbbec09914ecbc9af959f5933ae6f292) Thanks [@ganchoradkov](https://github.com/ganchoradkov)! - fixes a race condition in the `relayer` where `toEstablishConnection` could trigger new ws connection even though one already exists and enter into a loop

- Updated dependencies [[`baac2ac8ff62d1e98596440dd86bcefadf771b4d`](https://github.com/WalletConnect/walletconnect-monorepo/commit/baac2ac8ff62d1e98596440dd86bcefadf771b4d), [`c1d656f4bbbec09914ecbc9af959f5933ae6f292`](https://github.com/WalletConnect/walletconnect-monorepo/commit/c1d656f4bbbec09914ecbc9af959f5933ae6f292)]:
  - @walletconnect/sign-client@2.20.1
  - @walletconnect/types@2.20.1
  - @walletconnect/utils@2.20.1

## 2.20.0

### Patch Changes

- Updated dependencies []:
  - @walletconnect/utils@2.20.0
  - @walletconnect/sign-client@2.20.0
  - @walletconnect/types@2.20.0

## 2.19.4

### Patch Changes

- Updated dependencies []:
  - @walletconnect/utils@2.19.4
  - @walletconnect/sign-client@2.19.4
  - @walletconnect/types@2.19.4

## 2.19.3

### Patch Changes

- Updated dependencies []:
  - @walletconnect/utils@2.19.3
  - @walletconnect/sign-client@2.19.3
  - @walletconnect/types@2.19.3
