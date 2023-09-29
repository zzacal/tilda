# Tilda

## What
Tilda mocks services by creating an in-memory store of responses that can be retrieved by combining the path, params, and body of a request.

## Why
Some external dependencies are not stable within the scope of your tests. Tilda allows you to mock these dependencies.

## How
### Start the service
You can start the service as a container or as a local process.
#### **as a container**
``` bash
docker pull ghcr.io/zzacal/tilda:latest && \
docker run \
    --name=mocker \
    -p 5111:5111 \
    ghcr.io/zzacal/tilda
```

#### **as a local process**
``` bash
npm i && \
npm start
```

### Mock a call
#### **Request**
``` bash
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
#### **Request**
``` bash
curl --location --request GET 'localhost:5111/user?id=123'
```
#### Response
``` json
{
    "name": "Marco Polo"
}
```
### Seeding
You can seed mocks by placing the seed in the file `/data/seed.json`.

Alternatively, name your seed file whatever you want and set the variable `SEED`

Sample seed file:
```json
[
  {
    "path": "/user",
    "params": {
      "id": "123"
    },
    "body": {},
    "response": {
      "type": "obj",
      "status": "200",
      "body": {
        "name": "Marco Polo"
      }
    }
  }
]
```

You can combine seed files by storing seed json files in `/data/seeds/` or files in any directory set to the env `SEEDS_DIR` that matches the shape of the seed file above and has a `.json` extension.
