import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

export type Document = {
  id: number;
  name: string;
  content: string;
  size: number;
  createdAt: string;
  tags: string[];
};

export type DocumentSummary = Omit<Document, "content">;

export type SearchResult = Omit<Document, "content"> & {
  excerpt: string;
  highlights: Array<[number, number]>;
};

export type SearchFilters = {
  filename?: string;
  tag?: string;
};

export type TagSummary = {
  name: string;
  count: number;
};

export function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) throw new Error("Tags must be an array.");
  if (value.some((tag) => typeof tag !== "string")) {
    throw new Error("Every tag must be a string.");
  }
  const tags = [
    ...new Set(value.map((tag) => (tag as string).trim().toLowerCase()).filter(Boolean)),
  ];
  if (tags.length > 10) throw new Error("A document can have at most 10 tags.");
  if (tags.some((tag) => tag.length > 32)) {
    throw new Error("Tags can contain at most 32 characters.");
  }
  if (tags.some((tag) => !/^[a-z0-9][a-z0-9 _-]*$/.test(tag))) {
    throw new Error("Tags can use letters, numbers, spaces, hyphens, and underscores.");
  }
  return tags;
}

export function compileSearchQuery(input: string): string {
  const query = input.trim();
  if (!query) return "";
  const terms: string[] = [];
  let cursor = 0;

  while (cursor < query.length) {
    while (cursor < query.length && /\s/.test(query[cursor])) cursor += 1;
    if (cursor >= query.length) break;

    if (query[cursor] === '"') {
      const end = query.indexOf('"', cursor + 1);
      if (end === -1) throw new Error("Unclosed quoted phrase.");
      const phrase = query.slice(cursor + 1, end).trim();
      if (phrase) terms.push(phrase);
      cursor = end + 1;
    } else {
      let end = cursor;
      while (end < query.length && !/\s/.test(query[end])) end += 1;
      terms.push(query.slice(cursor, end));
      cursor = end;
    }
  }

  return terms
    .map((term) => `"${term.replaceAll('"', '""')}"`)
    .join(" AND ");
}

function parseHighlightedExcerpt(value: string, startMarker: string, endMarker: string) {
  let excerpt = "";
  const highlights: Array<[number, number]> = [];
  let cursor = 0;

  while (cursor < value.length) {
    const start = value.indexOf(startMarker, cursor);
    if (start === -1) {
      excerpt += value.slice(cursor);
      break;
    }
    excerpt += value.slice(cursor, start);
    const matchStart = excerpt.length;
    const end = value.indexOf(endMarker, start + startMarker.length);
    if (end === -1) {
      excerpt += value.slice(start);
      break;
    }
    excerpt += value.slice(start + startMarker.length, end);
    highlights.push([matchStart, excerpt.length]);
    cursor = end + endMarker.length;
  }

  return { excerpt, highlights };
}

export function createStore(databasePath = "data/sourcebound.db") {
  if (databasePath !== ":memory:") {
    mkdirSync(dirname(databasePath), { recursive: true });
  }

  const db = new DatabaseSync(databasePath);
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      content TEXT NOT NULL,
      size INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
      name,
      content,
      content='documents',
      content_rowid='id'
    );
    CREATE TRIGGER IF NOT EXISTS documents_ai AFTER INSERT ON documents BEGIN
      INSERT INTO documents_fts(rowid, name, content)
      VALUES (new.id, new.name, new.content);
    END;
    CREATE TRIGGER IF NOT EXISTS documents_ad AFTER DELETE ON documents BEGIN
      INSERT INTO documents_fts(documents_fts, rowid, name, content)
      VALUES ('delete', old.id, old.name, old.content);
    END;
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS document_tags (
      document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (document_id, tag_id)
    );
    CREATE INDEX IF NOT EXISTS document_tags_tag_id ON document_tags(tag_id);
  `);

  const getTags = (documentId: number) =>
    (
      db
        .prepare(
          `SELECT t.name
           FROM tags t
           JOIN document_tags dt ON dt.tag_id = t.id
           WHERE dt.document_id = ?
           ORDER BY t.name`,
        )
        .all(documentId) as Array<{ name: string }>
    ).map(({ name }) => name);

  const hydrate = <T extends { id: number }>(row: T): T & { tags: string[] } => ({
    ...row,
    tags: getTags(row.id),
  });

  const replaceTags = (documentId: number, tags: string[]) => {
    db.prepare("DELETE FROM document_tags WHERE document_id = ?").run(documentId);
    const insertTag = db.prepare("INSERT INTO tags (name) VALUES (?) ON CONFLICT(name) DO NOTHING");
    const linkTag = db.prepare(
      `INSERT INTO document_tags (document_id, tag_id)
       SELECT ?, id FROM tags WHERE name = ?`,
    );
    for (const tag of tags) {
      insertTag.run(tag);
      linkTag.run(documentId, tag);
    }
    db.exec("DELETE FROM tags WHERE id NOT IN (SELECT tag_id FROM document_tags)");
  };

  const filenamePattern = (filename: string) =>
    `%${filename.toLowerCase().replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;

  return {
    add(name: string, content: string, tags: string[] = []) {
      return this.addMany([{ name, content, tags }])[0];
    },
    addMany(items: Array<{ name: string; content: string; tags?: string[] }>): Document[] {
      const insert = db.prepare(
        "INSERT INTO documents (name, content, size) VALUES (?, ?, ?)",
      );
      const ids: number[] = [];
      db.exec("BEGIN");
      try {
        for (const item of items) {
          const tags = normalizeTags(item.tags ?? []);
          const result = insert.run(item.name, item.content, Buffer.byteLength(item.content));
          const id = Number(result.lastInsertRowid);
          ids.push(id);
          replaceTags(id, tags);
        }
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
      return ids.map((id) => this.get(id)!);
    },
    list(filters: SearchFilters = {}): DocumentSummary[] {
      const conditions: string[] = [];
      const parameters: string[] = [];
      if (filters.filename?.trim()) {
        conditions.push("LOWER(d.name) LIKE ? ESCAPE '\\'");
        parameters.push(filenamePattern(filters.filename.trim()));
      }
      if (filters.tag?.trim()) {
        conditions.push(
          `EXISTS (
             SELECT 1 FROM document_tags dt
             JOIN tags t ON t.id = dt.tag_id
             WHERE dt.document_id = d.id AND t.name = ?
           )`,
        );
        parameters.push(filters.tag.trim().toLowerCase());
      }
      const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
      const rows = db
        .prepare(
          `SELECT id, name, size, created_at AS createdAt
           FROM documents d ${where}
           ORDER BY created_at DESC, id DESC`,
        )
        .all(...parameters) as Array<Omit<DocumentSummary, "tags">>;
      return rows.map(hydrate);
    },
    get(id: number): Document | undefined {
      const row = db
        .prepare(
          `SELECT id, name, content, size, created_at AS createdAt
           FROM documents WHERE id = ?`,
        )
        .get(id) as Omit<Document, "tags"> | undefined;
      return row ? hydrate(row) : undefined;
    },
    search(query: string, filters: SearchFilters = {}): SearchResult[] {
      const markerId = randomUUID();
      const startMarker = `\uE000${markerId}:start\uE001`;
      const endMarker = `\uE000${markerId}:end\uE001`;
      const conditions = ["documents_fts MATCH ?"];
      const parameters: string[] = [startMarker, endMarker, compileSearchQuery(query)];
      if (filters.filename?.trim()) {
        conditions.push("LOWER(d.name) LIKE ? ESCAPE '\\'");
        parameters.push(filenamePattern(filters.filename.trim()));
      }
      if (filters.tag?.trim()) {
        conditions.push(
          `EXISTS (
             SELECT 1 FROM document_tags dt
             JOIN tags t ON t.id = dt.tag_id
             WHERE dt.document_id = d.id AND t.name = ?
           )`,
        );
        parameters.push(filters.tag.trim().toLowerCase());
      }
      const rows = db
        .prepare(
          `SELECT d.id, d.name, d.size, d.created_at AS createdAt,
                  snippet(documents_fts, 1, ?, ?, '...', 24) AS excerpt
           FROM documents_fts
           JOIN documents d ON d.id = documents_fts.rowid
           WHERE ${conditions.join(" AND ")}
           ORDER BY bm25(documents_fts, 8.0, 1.0), d.created_at DESC
           LIMIT 50`,
        )
        .all(...parameters) as Array<Omit<SearchResult, "highlights" | "tags">>;
      return rows.map((row) => ({
        ...hydrate(row),
        ...parseHighlightedExcerpt(row.excerpt, startMarker, endMarker),
      }));
    },
    setTags(id: number, value: unknown): Document | undefined {
      if (!this.get(id)) return undefined;
      const tags = normalizeTags(value);
      db.exec("BEGIN");
      try {
        replaceTags(id, tags);
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
      return this.get(id);
    },
    listTags(): TagSummary[] {
      return db
        .prepare(
          `SELECT t.name, COUNT(dt.document_id) AS count
           FROM tags t
           JOIN document_tags dt ON dt.tag_id = t.id
           GROUP BY t.id, t.name
           ORDER BY t.name`,
        )
        .all() as TagSummary[];
    },
    remove(id: number) {
      return db.prepare("DELETE FROM documents WHERE id = ?").run(id).changes > 0;
    },
    close() {
      db.close();
    },
  };
}

export type Store = ReturnType<typeof createStore>;
