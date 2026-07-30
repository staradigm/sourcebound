import type { Server } from "node:http";
import { createApp } from "./app.js";
import type { Store } from "./store.js";

export const LOOPBACK_HOST = "127.0.0.1";

export function startServer(store: Store, port: number): Server {
  return createApp(store).listen(port, LOOPBACK_HOST);
}
