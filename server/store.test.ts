import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { compileSearchQuery, createStore, type Store } from "./store.js";

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

  it("migrates a v0.1 database without changing documents or search data", () => {
    store.close();
    const directory = mkdtempSync(join(tmpdir(), "sourcebound-v01-"));
    const databasePath = join(directory, "legacy.db");
    const legacy = new DatabaseSync(databasePath);
    legacy.exec(`
      CREATE TABLE documents (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        content TEXT NOT NULL,
        size INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE VIRTUAL TABLE documents_fts USING fts5(
        name, content, content='documents', content_rowid='id'
      );
      CREATE TRIGGER documents_ai AFTER INSERT ON documents BEGIN
        INSERT INTO documents_fts(rowid, name, content)
        VALUES (new.id, new.name, new.content);
      END;
      CREATE TRIGGER documents_ad AFTER DELETE ON documents BEGIN
        INSERT INTO documents_fts(documents_fts, rowid, name, content)
        VALUES ('delete', old.id, old.name, old.content);
      END;
      INSERT INTO documents (name, content, size)
      VALUES ('legacy.md', 'Preserved migration evidence.', 29);
    `);
    legacy.close();

    try {
      store = createStore(databasePath);
      expect(store.get(1)).toMatchObject({
        name: "legacy.md",
        content: "Preserved migration evidence.",
        tags: [],
      });
      expect(store.search("migration")[0].name).toBe("legacy.md");
      expect(store.setTags(1, ["migrated"])?.tags).toEqual(["migrated"]);
      store.close();
      store = createStore(databasePath);
      expect(store.get(1)?.tags).toEqual(["migrated"]);
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

  it("normalizes tags and combines filename and tag filters", () => {
    const research = store.add("research-notes.md", "A retrieval benchmark.", [
      " Research ",
      "RESEARCH",
      "evaluation",
    ]);
    store.add("meeting.txt", "A retrieval discussion.", ["work"]);

    expect(research!.tags).toEqual(["evaluation", "research"]);
    expect(store.list({ tag: "research" }).map(({ name }) => name)).toEqual([
      "research-notes.md",
    ]);
    expect(
      store.search("retrieval", { filename: "notes", tag: "research" }).map(({ name }) => name),
    ).toEqual(["research-notes.md"]);
    expect(store.listTags()).toEqual([
      { name: "evaluation", count: 1 },
      { name: "research", count: 1 },
      { name: "work", count: 1 },
    ]);
  });

  it("rolls back an entire batch when one item has invalid tags", () => {
    expect(() =>
      store.addMany([
        { name: "valid.md", content: "Valid content." },
        { name: "invalid.md", content: "Invalid metadata.", tags: ["bad!tag"] },
      ]),
    ).toThrow("Tags can use");
    expect(store.list()).toEqual([]);
    expect(store.search("Valid")).toEqual([]);
    expect(store.listTags()).toEqual([]);
  });

  it("ranks filename matches ahead of body-only matches", () => {
    store.add("ordinary.md", "The project codename is lighthouse.");
    store.add("lighthouse-plan.md", "The project plan uses a different internal label.");

    expect(store.search("lighthouse")[0].name).toBe("lighthouse-plan.md");
  });

  it("treats punctuation as text and preserves quoted phrases", () => {
    store.add("interview.md", "Use open-ended questions during oral history.");

    expect(store.search("open-ended questions")).toHaveLength(1);
    expect(compileSearchQuery('"oral history" questions')).toBe(
      '"oral history" AND "questions"',
    );
    expect(() => store.search('"oral history')).toThrow("Unclosed quoted phrase");
  });

  it("enforces tag boundaries after normalization and rejects non-strings", () => {
    const duplicateTags = Array.from({ length: 11 }, (_, index) =>
      index % 2 ? "Research" : " research ",
    );
    expect(store.add("deduplicated.md", "Tags normalize.", duplicateTags)?.tags).toEqual([
      "research",
    ]);
    expect(() =>
      store.setTags(
        1,
        Array.from({ length: 11 }, (_, index) => `tag-${index}`),
      ),
    ).toThrow("at most 10");
    expect(() => store.setTags(1, ["valid", 123])).toThrow("must be a string");
    expect(store.setTags(1, ["a".repeat(32)])?.tags).toEqual(["a".repeat(32)]);
    expect(() => store.setTags(1, ["a".repeat(33)])).toThrow("at most 32");
  });
});
