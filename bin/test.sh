#!/usr/bin/env bash
set +e
pkill -f '.*node.*testserver.js.*'
pkill -f '.*node.*dummy-oidc-server.*'
set -e

# Start dummy OIDC server
echo "Starting dummy OIDC server..."
node specs/helpers/dummy-oidc-server.js &
OIDC_PID=$!

# Wait for OIDC server to be ready
sleep 3

# Check if OIDC server is running
if ! ps -p $OIDC_PID; then
  echo "Dummy OIDC server failed to start!"
  exit 1
fi

echo "Dummy OIDC server is running with PID ${OIDC_PID}"

# Configure environment for OIDC authentication
export AUTH_ISSUER_BASE_URL=http://localhost:3002
export AUTH_CLIENT_ID=test-client
export AUTH_TOKEN_AUDIENCE=localhost:3000
export ALLOW_HTTP_AUTHENTICATION_HEADER=true
export NODE_ENV=production

# Build the test app
npx webpack --config ./specs.wdio/testapp/webpack.config.js

# Start the test server
bin/testserver.sh&
SERVER_PID=$!

sleep 2

if ! ps -p $SERVER_PID; then
  echo "Node test server is NOT running!!! Maybe the server is running already and blocking the port. Check for 'ps aux | grep testserver' and terminate it."
  kill $OIDC_PID
  exit 1
fi

echo "Node server is running with PID ${SERVER_PID}"

# Run karma tests
npx karma start

# Cleanup
kill $SERVER_PID
kill $OIDC_PID
