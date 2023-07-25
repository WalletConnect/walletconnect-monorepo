FROM node:20-alpine as base

WORKDIR /

RUN apk --update --no-cache \
    add g++ make python3

FROM base as build

WORKDIR /

COPY ../ ./
RUN npm ci
RUN npm run build

WORKDIR /packages/sign-client/

CMD ["node", "-v"]