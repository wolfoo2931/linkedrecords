#!/usr/bin/env bash

pkill -f '.*node.*testserver.js.*'
node --enable-source-maps specs.wdio/testapp/testserver.js | bin/plogs.js