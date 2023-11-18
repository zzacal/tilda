# Starting Tilda as a process

## Requirements

1. nodejs 20.x

## Configure requests and responses

You need to set up files that configure how tilda will respond to requests. To make it easy to manage your configurations, you can use multiple files and each file stores an array of configurations.

Let's walk through one example of a seed file.

Check out this sample config in [documentation/sample-seeds/user.json](../sample-seeds/user.json);

Notice that the configuration is an array of objects that define a `request` and a `response`.

## Install dependnencies, build, and run

At the root of the repo run:
```sh
npm i &&
npm run build &&
SEEDS_DIR=./documentation/sample-seeds node .
```

Tilda will listen at http://localhost:5111

## Testing

You specified that your request will have a path `user/007` and the query param `secret=true`.

Go ahead and navigate your browser to http://localhost:5111/user/007?secret=true or make that request in your command line.

```sh
curl -X GET "http://localhost:5111/user/007?secret=true"
```

## Congratulations

You can now mock different requests using Tilda.
