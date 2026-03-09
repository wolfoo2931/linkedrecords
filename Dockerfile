FROM node:24-alpine AS builder
WORKDIR /usr/src/app
RUN apk update && apk add git openssh python3 g++ make libpq-dev
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM node:24-alpine
WORKDIR /usr/src/app
RUN apk update && apk add libpq
COPY --from=builder /usr/src/app/dist/server.js /usr/src/app/server.js
COPY --from=builder /usr/src/app/node_modules /usr/src/app/node_modules
CMD [ "node", "server.js" ]