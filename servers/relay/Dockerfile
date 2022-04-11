FROM node:16.14-alpine as base

WORKDIR /usr/src/app

COPY package.json package-lock.json ./
COPY tsconfig.json ./
RUN npm install 

COPY ./src ./src
RUN npm run compile

FROM node:16.14-alpine as production

WORKDIR /usr/src/app

COPY package.json package-lock.json ./
RUN npm install --production

FROM node:16.14-alpine as final

ENV NODE_ENV production

WORKDIR /usr/src/app

COPY package.json package-lock.json ./
COPY --from=base /usr/src/app/dist ./dist/
COPY --from=production /usr/src/app/node_modules ./node_modules/

USER node

ENTRYPOINT ["node", "./dist/"]