# WalletConnect v2.x.x

TODO

## Setting up development env

1. Install python3 and ensure `python` cli is linked (required to build npm modules)
2. Install redis and run it as a [brew service](https://gist.github.com/tomysmile/1b8a321e7c58499ef9f9441b2faa0aa8)
3. Start ts-relay server ([separate repo](https://github.com/WalletConnect/ts-relay)) `PORT=5555 npm run start`
4. If you update npm packages, run `npm run test`

#### Troubleshooting

1. If you are experiencing issues with installation ensure you install `npm i -g node-gyp`
2. You will need to have xcode command line tools installed
3. If there are issues with xcode command line tools try running

```zsh
sudo xcode-select --switch /Library/Developer/CommandLineTools
sudo xcode-select --reset
```
