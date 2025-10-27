FROM node:22-alpine AS base

WORKDIR /

RUN apk --update --no-cache \
    add g++ make python3

FROM base AS build

# setting the workdir resolves npm Error: Tracker "idealTree" already exists
WORKDIR /sdk

COPY ../ ./
RUN npm ci
RUN npm run build

WORKDIR /sdk/packages/sign-client/

CMD ["node", "-v"]