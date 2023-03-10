#!/usr/bin/env bash

if [[ -z "${GITHUB_TOKEN}" ]]; then
  read -p "Enter GitHub tocken to publish image: " GITHUB_TOKEN
  export GITHUB_TOKEN
fi

docker build --platform linux/x86-64 --build-arg GITHUB_TOKEN=$GITHUB_TOKEN -t ghcr.io/wolfoo2931/linkedrecords:latest .
docker push ghcr.io/wolfoo2931/linkedrecords:latest