FROM node:12-slim as builder
WORKDIR /app
COPY *.json ./
RUN npm install
COPY packages/types packages/types
COPY packages/utils packages/utils
COPY packages/relay packages/relay
RUN /app/node_modules/.bin/lerna bootstrap --hoist \
  --scope @walletconnect/types \
  --scope @walletconnect/utils \
  --scope @walletconnect/relay-server
RUN /app/node_modules/.bin/lerna run build \
  --scope @walletconnect/types \
  --scope @walletconnect/utils \
  --scope @walletconnect/relay-server

CMD ["node", "/app/packages/relay/dist"]
