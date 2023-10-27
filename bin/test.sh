#!/usr/bin/env bash

export DISABLE_AUTHENTICATION=true
export NODE_ENV=production

npx webpack --config ./testapp/webpack.config.js
node testapp/testserver.js --enable-source-maps&
SERVER_PID=$!
echo "Node server is running on with PID ${SERVER_PID}"
sleep 1
npx karma start
kill $SERVER_PID