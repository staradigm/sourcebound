import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createStore, type Store } from "./store.js";

describe("document store", () => {
  let store: Store;

  beforeEach(() => {
    store = createStore(":memory:");
  });

  afterEach(() => {
    store.close();
  });

  it("indexes imported content and returns a source excerpt", () => {
    store.add("notes.md", "Trustworthy answers cite the exact source passage.");

    const results = store.search("trustworthy");

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("notes.md");
    expect(results[0].excerpt).toContain("Trustworthy");
    expect(results[0].highlights).toEqual([[0, 11]]);
  });

  it("persists documents after the database is closed and reopened", () => {
    store.close();
    const directory = mkdtempSync(join(tmpdir(), "sourcebound-store-"));
    const databasePath = join(directory, "persistence.db");

    try {
      store = createStore(databasePath);
      store.add("persistent.md", "Content survives a restart.");
      store.close();
      store = createStore(databasePath);
      expect(store.list()[0].name).toBe("persistent.md");
      expect(store.search("survives")).toHaveLength(1);
    } finally {
      store.close();
      store = createStore(":memory:");
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("removes the document from both the library and search index", () => {
    const document = store.add("temporary.txt", "This content should disappear.");

    expect(store.remove(document!.id)).toBe(true);
    expect(store.list()).toEqual([]);
    expect(store.search("disappear")).toEqual([]);
  });
});
