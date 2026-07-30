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
});
