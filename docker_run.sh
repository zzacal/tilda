#!/bin/bash
docker stop mocker|| true &&
docker container rm mocker|| true &&
docker image rm tilda:dev || true &&
docker build -t tilda:dev . &&
docker run -d \
  -v ./seeds:/data/seeds/ \
  --name=mocker\
  -p 5111:5111 \
  tilda:dev
  