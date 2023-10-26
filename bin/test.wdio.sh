#!/usr/bin/env bash

export NODE_ENV=production
export SERVER_BASE_URL=http://localhost:3000
export FRONTEND_BASE_URL=http://localhost:3002

npx webpack --config ./testapp/webpack.config.js

node testapp/testserver.js --enable-source-maps&
SERVER_PID=$!
echo "Node server is running on with PID ${SERVER_PID}"
sleep 2
npx wdio run ./wdio.conf.ts
kill $SERVER_PID