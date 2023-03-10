FROM node:19-alpine as builder
ARG GITHUB_TOKEN
WORKDIR /usr/src/app
RUN apk update && apk add git openssh python3 g++ make libpq-dev
RUN git config --global url."https://x-oauth-basic:${GITHUB_TOKEN}@github.com/".insteadOf "ssh://git@github.com/"
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY . .
RUN npm run build

FROM node:19-alpine
WORKDIR /usr/src/app
RUN apk update && apk add libpq
COPY --from=builder /usr/src/app/dist/server.js /usr/src/app/server.js
COPY --from=builder /usr/src/app/node_modules /usr/src/app/node_modules
CMD [ "node", "server.js" ]