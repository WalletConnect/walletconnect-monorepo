FROM node:12-slim

WORKDIR /app
COPY package.json ./
COPY package-lock.json ./
RUN npm install --no-optional && npm cache clean --force

COPY . .
RUN npm run build

CMD ["node", "/app/build"]
