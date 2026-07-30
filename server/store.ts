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
};

export type SearchResult = Omit<Document, "content"> & {
  excerpt: string;
  highlights: Array<[number, number]>;
};

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
  `);

  return {
    add(name: string, content: string) {
      const result = db
        .prepare("INSERT INTO documents (name, content, size) VALUES (?, ?, ?)")
        .run(name, content, Buffer.byteLength(content));
      return this.get(Number(result.lastInsertRowid));
    },
    list(): Omit<Document, "content">[] {
      return db
        .prepare(
          `SELECT id, name, size, created_at AS createdAt
           FROM documents ORDER BY created_at DESC, id DESC`,
        )
        .all() as Omit<Document, "content">[];
    },
    get(id: number): Document | undefined {
      return db
        .prepare(
          `SELECT id, name, content, size, created_at AS createdAt
           FROM documents WHERE id = ?`,
        )
        .get(id) as Document | undefined;
    },
    search(query: string): SearchResult[] {
      const markerId = randomUUID();
      const startMarker = `\uE000${markerId}:start\uE001`;
      const endMarker = `\uE000${markerId}:end\uE001`;
      const rows = db
        .prepare(
          `SELECT d.id, d.name, d.size, d.created_at AS createdAt,
                  snippet(documents_fts, 1, ?, ?, '...', 24) AS excerpt
           FROM documents_fts
           JOIN documents d ON d.id = documents_fts.rowid
           WHERE documents_fts MATCH ?
           ORDER BY rank LIMIT 50`,
        )
        .all(startMarker, endMarker, query) as Array<Omit<SearchResult, "highlights">>;
      return rows.map((row) => ({ ...row, ...parseHighlightedExcerpt(row.excerpt, startMarker, endMarker) }));
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
