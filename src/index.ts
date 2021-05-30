import Server from "./server";

const port = parseInt(process.env.PORT ?? "5111");

new Server().listen(port);
