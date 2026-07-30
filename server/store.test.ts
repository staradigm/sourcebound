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
    expect(results[0].excerpt).toContain("<mark>Trustworthy</mark>");
  });

  it("removes the document from both the library and search index", () => {
    const document = store.add("temporary.txt", "This content should disappear.");

    expect(store.remove(document!.id)).toBe(true);
    expect(store.list()).toEqual([]);
    expect(store.search("disappear")).toEqual([]);
  });
});
