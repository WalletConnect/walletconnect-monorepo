ARG githash
FROM node:14-slim
ARG githash
ENV GITHASH=${githash}
COPY ./servers/relay/package.json /tmp
COPY ./servers/relay/package-lock.json /tmp
RUN npm ci --prefix /tmp

WORKDIR /relay
RUN cp -a /tmp/node_modules ./node_modules
COPY ./servers/relay .
RUN npm run build

USER node
CMD node /relay/dist
