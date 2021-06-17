#!/bin/bash
docker stop mocker|| true &&
docker container rm mocker|| true &&
docker build -t tilda:dev . &&
docker run -d \
    --name=mocker\
    -p 5111:5111 \
    tilda:dev