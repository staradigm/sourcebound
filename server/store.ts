import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
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
};

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
      return db
        .prepare(
          `SELECT d.id, d.name, d.size, d.created_at AS createdAt,
                  snippet(documents_fts, 1, '<mark>', '</mark>', '...', 24) AS excerpt
           FROM documents_fts
           JOIN documents d ON d.id = documents_fts.rowid
           WHERE documents_fts MATCH ?
           ORDER BY rank LIMIT 50`,
        )
        .all(query) as SearchResult[];
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
