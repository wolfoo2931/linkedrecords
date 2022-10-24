npx webpack --config ./webpack-testserver.config.js
node dist/testserver.js&
SERVER_PID=$!
echo "Node server is running on with PID ${SERVER_PID}"
sleep 1
npx karma start
kill $SERVER_PID