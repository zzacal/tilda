# Starting Tilda as a container

## Requirements

1. docker compose (I use docker desktop or rancher desktop)

## Configure requests and responses

You need to set up files that configure how tilda will respond to requests. To make it easy to manage your configurations, you can use multiple files and each file stores an array of configurations.

Let's walk through one example of a seed file.

Check out this sample config in [documentation/sample-seeds/user.json](../sample-seeds/user.json);

Notice that the configuration is an array of objects that define a `request` and a `response`.

## Set up the compose file

Checkout this sample docker-compose.yml file [documentation/docker-compose.yml](./docker-compose.yml).

It specifies that tilda will be served on port `8110` using the configuration in [documentation/seed/user.json](./seeds/user.json).

## Start the container

Make sure the Docker daemon is running by starting docker desktop or rancher desktop.

Navigate to the folder containing docker-compose.yml and start the container. Run these commands from the root of the repo.

```sh
cd documentation/as-container 
&& docker compose up -d
```

## Testing

You specified that your request will have a path `user/007` and the query param `secret=true`.

Go ahead and navigate your browser to http://localhost:8110/user/007?secret=true or make that request in your command line.

```sh
curl -X GET "http://localhost:8110/user/007?secret=true"
```

## Conclusion

You can now mock different requests using Tilda in a container.
