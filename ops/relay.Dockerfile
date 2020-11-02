FROM node:12-slim as builder
RUN npm install -g nodemon
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

CMD ["nodemon", "/app/packages/relay/dist"]
