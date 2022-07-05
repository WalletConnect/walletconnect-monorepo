FROM node:16.14-alpine as base

WORKDIR /

RUN apk --update --no-cache \
    add g++ make python3

FROM base as build

WORKDIR /

COPY ./packages/sign-client/ ./
COPY ./tsconfig.json ./tsconfig.json.base
RUN npm install -f
RUN rm ./tsconfig.json
RUN echo '{"extends": "./tsconfig.json.base","include": ["./src/**/*"],"compilerOptions": {"outDir": "./dist"}}' >> ./tsconfig.json
RUN npm run build

CMD ["node", "-v"]
