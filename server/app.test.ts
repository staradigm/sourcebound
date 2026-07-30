import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "./app.js";
import { createStore, type Store } from "./store.js";

describe("document API", () => {
  let store: Store;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    store = createStore(":memory:");
    app = createApp(store);
  });

  afterEach(() => store.close());

  it("imports, lists, retrieves, searches, and deletes a document", async () => {
    const imported = await request(app)
      .post("/api/documents")
      .attach("file", Buffer.from("A precise source makes retrieval trustworthy."), "notes.md")
      .expect(201);

    const id = imported.body.id;
    expect((await request(app).get("/api/documents").expect(200)).body).toHaveLength(1);
    expect((await request(app).get(`/api/documents/${id}`).expect(200)).body.content)
      .toContain("precise source");

    const search = await request(app).get("/api/search").query({ q: "trustworthy" }).expect(200);
    expect(search.body[0]).toMatchObject({ id, name: "notes.md" });
    expect(search.body[0].excerpt).toContain("trustworthy");
    expect(search.body[0].highlights).toHaveLength(1);

    await request(app).delete(`/api/documents/${id}`).expect(204);
    expect((await request(app).get("/api/search").query({ q: "trustworthy" }).expect(200)).body)
      .toEqual([]);
    await request(app).get(`/api/documents/${id}`).expect(404);
  });

  it("rejects unsupported, empty, and oversized files", async () => {
    const unsupported = await request(app)
      .post("/api/documents")
      .attach("file", Buffer.from("binary"), "notes.pdf")
      .expect(400);
    expect(unsupported.body.error).toContain("Only .md and .txt");

    const empty = await request(app)
      .post("/api/documents")
      .attach("file", Buffer.from(""), "empty.txt")
      .expect(400);
    expect(empty.body.error).toContain("empty");

    const oversized = await request(app)
      .post("/api/documents")
      .attach("file", Buffer.alloc(5 * 1024 * 1024 + 1, "a"), "large.txt")
      .expect(400);
    expect(oversized.body.error).toContain("File too large");
  });

  it("returns actionable feedback for malformed FTS syntax", async () => {
    store.add("notes.txt", "Searchable text");
    const response = await request(app).get("/api/search").query({ q: '"' }).expect(400);
    expect(response.body).toEqual({ error: "Use words or a quoted phrase to search." });
  });

  it("returns untrusted excerpts as data rather than executable markup", async () => {
    store.add("unsafe.txt", '<img src=x onerror="alert(1)"> trustworthy');
    const response = await request(app)
      .get("/api/search")
      .query({ q: "trustworthy" })
      .expect(200);
    expect(response.body[0].excerpt).toContain("<img");
    expect(response.headers["content-type"]).toContain("application/json");
  });

  it("reports health", async () => {
    expect((await request(app).get("/api/health").expect(200)).body).toEqual({ status: "ok" });
  });

  it("imports a valid batch atomically", async () => {
    const response = await request(app)
      .post("/api/documents/batch")
      .attach("files", Buffer.from("First valid source."), "first.md")
      .attach("files", Buffer.from("Second valid source."), "second.txt")
      .expect(201);
    expect(response.body.imported).toBe(2);
    expect(store.list()).toHaveLength(2);

    await request(app)
      .post("/api/documents/batch")
      .attach("files", Buffer.from("Would otherwise be valid."), "third.md")
      .attach("files", Buffer.from(""), "empty.txt")
      .expect(400);
    expect(store.list()).toHaveLength(2);
  });

  it("rejects mixed unsupported and over-limit batches without partial writes", async () => {
    await request(app)
      .post("/api/documents/batch")
      .attach("files", Buffer.from("Valid source."), "valid.md")
      .attach("files", Buffer.from("Unsupported source."), "unsupported.pdf")
      .expect(400);
    expect(store.list()).toEqual([]);

    let requestBuilder = request(app).post("/api/documents/batch");
    for (let index = 0; index < 51; index += 1) {
      requestBuilder = requestBuilder.attach(
        "files",
        Buffer.from(`Source ${index}.`),
        `source-${index}.md`,
      );
    }
    await requestBuilder.expect(400);
    expect(store.list()).toEqual([]);
  });

  it("updates tags and filters library and search results", async () => {
    const research = store.add("research.md", "A trustworthy retrieval source.");
    store.add("personal.md", "Another trustworthy source.");

    const updated = await request(app)
      .patch(`/api/documents/${research!.id}/tags`)
      .send({ tags: [" Research ", "EVALUATION"] })
      .expect(200);
    expect(updated.body.tags).toEqual(["evaluation", "research"]);

    const tags = await request(app).get("/api/tags").expect(200);
    expect(tags.body).toContainEqual({ name: "research", count: 1 });
    const library = await request(app)
      .get("/api/documents")
      .query({ filename: "research", tag: "evaluation" })
      .expect(200);
    expect(library.body.map(({ name }: { name: string }) => name)).toEqual(["research.md"]);
    const search = await request(app)
      .get("/api/search")
      .query({ q: "trustworthy", tag: "research" })
      .expect(200);
    expect(search.body.map(({ name }: { name: string }) => name)).toEqual(["research.md"]);

    await request(app)
      .patch(`/api/documents/${research!.id}/tags`)
      .send({ tags: [] })
      .expect(200);
    expect((await request(app).get("/api/tags").expect(200)).body).toEqual([]);
  });
});
