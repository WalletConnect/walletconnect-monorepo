# JS Dev Environment

1. Install python3 and ensure `python` cli is linked (required to build npm modules)
2. Install redis and run it as a [brew service](https://gist.github.com/tomysmile/1b8a321e7c58499ef9f9441b2faa0aa8)
3. Bootstrap lerna (install npm packages) `npm run bootstrap`
4. Verify installation `npm run check`
5. Start relay server `PORT=5555 npm run start --prefix=servers/relay`
6. If you update npm packages, run `npm run test --prefix=packages/client`
