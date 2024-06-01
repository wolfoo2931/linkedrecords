#!/usr/bin/env bash
set -e

export DISABLE_AUTHENTICATION=true
export NODE_ENV=production

npx webpack --config ./specs.wdio/testapp/webpack.config.js
node --enable-source-maps specs.wdio/testapp/testserver.js&
SERVER_PID=$!
echo "Node server is running on with PID ${SERVER_PID}"
sleep 1
npx karma start
kill $SERVER_PID