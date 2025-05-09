#!/usr/bin/env bash
set +e
pkill -f '.*node.*testserver.js.*'
set -e

export NODE_ENV=production
export SERVER_BASE_URL=http://localhost:3000
export FRONTEND_BASE_URL=http://localhost:3002
export QUOTA_COUNT_KV_ATTRIBUTES=true
export QUOTA_COUNT_LT_ATTRIBUTES=true

npx webpack --config ./specs.wdio/testapp/webpack.config.js

bin/testserver.sh&
SERVER_PID=$!

sleep 2

if ! ps -p $SERVER_PID; then
  echo "Node test server is NOT running!!! Maybe the server is running already and blocking the port. Check for 'ps aux | grep testserver' and terminate it."
  exit 1
fi

echo "Node server is running on with PID ${SERVER_PID}"

npx wdio run ./wdio.conf.ts "$@"
succ=$?
kill $SERVER_PID

pkill -f '.*node.*testserver.js.*'

if [ $succ -eq 0 ]; then
  exit 0
else
  exit 1
fi