FROM node:16.14-alpine as base

WORKDIR /usr/src/app

RUN apk --update --no-cache \
        add g++ make python3

FROM base as build

COPY package.json package-lock.json ./
COPY tsconfig.json ./
RUN npm install 

COPY ./src ./src
RUN npm run compile

FROM base as production

COPY package.json package-lock.json ./
RUN npm install --production

FROM base as final 

ENV NODE_ENV production

COPY package.json package-lock.json ./
COPY --from=build /usr/src/app/dist ./dist/
COPY --from=production /usr/src/app/node_modules ./node_modules/

USER node

ENTRYPOINT ["node", "./dist/"]