#!/usr/bin/env bash
set +e
pkill -f '.*node.*testserver.js.*'
set -e

export DISABLE_AUTHENTICATION=true
export NODE_ENV=production

npx webpack --config ./specs.wdio/testapp/webpack.config.js
bin/testserver.sh&
SERVER_PID=$!

sleep 2

if ! ps -p $SERVER_PID; then
  echo "Node test server is NOT running!!! Maybe the server is running already and blocking the port. Check for 'ps aux | grep testserver' and terminate it."
  exit 1
fi

echo "Node server is running on with PID ${SERVER_PID}"

npx karma start
kill $SERVER_PID