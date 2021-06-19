# Tilda

## What
Tilda mocks services by creating an in-memory store of responses that can be retrieved by combining the path, params, and body of a request.

## Why
Some external dependencies are not stable within the scope of your tests. Tilda allows you to mock these dependencies.

## How
### Start the service as a container
```
docker pull jizacal/tilda && \
docker run \
    --name=mocker \
    -p 5111:5111 \
    jizacal/tilda
```

### Start the service
```
npm i && \
npm start
```

### Mock a call
#### Request
```
curl --location --request POST 'localhost:5111/mock' \
--header 'Content-Type: application/json' \
--data-raw '{
    "request": {
        "path": "/user",
        "params": {
            "id": "123"
        },
        "body": {}
    },
    "response": {
        "type": "obj",
        "status": "200",
        "body": {
            "name": "Marco Polo"
        }
    }
}'
```

### Tilda responds with val
#### Request
```
curl --location --request GET 'localhost:5111/user?id=123'
```
#### Response
```
{
    "name": "Marco Polo"
}
```
