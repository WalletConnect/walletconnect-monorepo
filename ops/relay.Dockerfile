FROM node:12-slim as builder
RUN npm install -g nodemon
WORKDIR /relay
COPY ./servers/relay/*.json ./
COPY ./servers/relay/src ./
COPY ./packages/types/ /packages/types
RUN npm install
RUN npm build

CMD ["nodemon", "/relay/dist"]
