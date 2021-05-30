import Server from "./server";

const port = parseInt(process.env.PORT ?? "5111");
const mockPath = process.env.MOCK_PATH ?? "/mock"
new Server(mockPath).listen(port);
