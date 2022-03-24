# JS Dev environment

## Setup

1. Run Redis on the background (recommended brew services)
2. Install Relay Server dependencies
3. Run "PORT=5555 npm run start" for relay server
4. Develop!

## Develop

- Make sure root dependencies are installed (npm install)
- Call bootstrap for the first time (npm run bootstrap)
- Then you can either run: - npm run check = this will call lint, build and test - npm run reset = this will install fresh dependencies before doing `check` script
