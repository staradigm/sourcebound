import { createApp } from "./app.js";
import { createStore } from "./store.js";

const port = Number(process.env.PORT ?? 4318);
const store = createStore(process.env.DATABASE_PATH);

const server = createApp(store).listen(port, () => {
  console.log(`Sourcebound API listening on http://localhost:${port}`);
});

server.on("error", (error) => {
  console.error(`Sourcebound API failed to start on port ${port}:`, error.message);
  store.close();
  process.exitCode = 1;
});
