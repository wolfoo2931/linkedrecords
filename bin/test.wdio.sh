#!/usr/bin/env bash

export NODE_ENV=production
export SERVER_BASE_URL=http://localhost:3000
export FRONTEND_BASE_URL=http://localhost:3002

npx webpack --config ./specs.wdio/testapp/webpack.config.js

node specs.wdio/testapp/testserver.js --enable-source-maps&
SERVER_PID=$!
echo "Node server is running on with PID ${SERVER_PID}"
sleep 2
npx wdio run ./wdio.conf.ts
succ=$?
kill $SERVER_PID

if [ $succ -eq 0 ]; then
  exit 0
else
  exit 1
fi