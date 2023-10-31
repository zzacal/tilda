#!/bin/bash
docker build -t tilda:dev . &&
docker stop mocker|| true &&
docker container rm mocker|| true &&
docker run \
  -v ./seeds:/data/seeds/ \
  --name=mocker\
  -p 5111:5111 \
  tilda:dev
  