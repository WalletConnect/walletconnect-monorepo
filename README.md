# WalletConnect v2.x.x

Open protocol for connecting Wallets to Dapps - https://walletconnect.com

## Setup development

1. Install [nodejs and npm](https://nodejs.org/en/)
2. Install python3 and ensure `python` cli is linked (required to build some npm modules)
3. Install workspace dependencies i.e. run `npm install` from root folder
4. Install redis. We recomend running it as a [brew service](https://gist.github.com/tomysmile/1b8a321e7c58499ef9f9441b2faa0aa8)
5. Pull and start ts-relay server ([separate repo](https://github.com/WalletConnect/ts-relay)) `PORT=5555 npm run start`
6. Ensure everything runs correctly by executing `npm run check`

## Troubleshooting

1. If you are experiencing issues with installation ensure you install `npm i -g node-gyp`
2. You will need to have xcode command line tools installed
3. If there are issues with xcode command line tools try running

```zsh
sudo xcode-select --switch /Library/Developer/CommandLineTools
sudo xcode-select --reset
```

## Commands

`clean` - Removes build folders from all packages
`lint` - Runs [eslint](https://eslint.org/) checks
`prettier` - Runs [prettier](https://prettier.io/) checks
`build` - Builds all packages
`test` - Tests all packages
`check` - Shorthand to run lint, build and test commands
`reset` - Shorthand to run clean anc check commands

## License

Apache 2.0
