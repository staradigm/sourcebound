import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { LOOPBACK_HOST, startServer } from "./server.js";
import { createStore, type Store } from "./store.js";

describe("local API server", () => {
  let store: Store | undefined;

  afterEach(() => store?.close());

  it("binds only to the IPv4 loopback interface", async () => {
    store = createStore(":memory:");
    const server = startServer(store, 0);
    await new Promise<void>((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });

    try {
      expect((server.address() as AddressInfo).address).toBe(LOOPBACK_HOST);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
