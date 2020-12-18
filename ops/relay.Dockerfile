FROM node:12-slim as builder
COPY ./servers/relay/package.json /tmp
COPY ./servers/relay/package-lock.json /tmp
RUN npm ci --prefix /tmp

WORKDIR /relay
RUN npm -g install nodemon
RUN cp -a /tmp/node_modules ./node_modules
COPY ./servers/relay .
RUN npm run build

CMD ["nodemon", "/relay/dist"]
