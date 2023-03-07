export DISABLE_AUTHENTICATION=true
export COOKIE_DOMAIN=localhost
export NODE_ENV=production

npx webpack --config ./webpack-testserver.config.js
node dist/testserver.js --enable-source-maps&
SERVER_PID=$!
echo "Node server is running on with PID ${SERVER_PID}"
sleep 1
npx karma start
kill $SERVER_PID