import express from "express";
import multer, { MulterError } from "multer";
import type { Store } from "./store.js";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 50 },
  fileFilter: (_request, file, callback) => {
    const allowed = [".md", ".txt"].some((extension) =>
      file.originalname.toLowerCase().endsWith(extension),
    );
    if (allowed) callback(null, true);
    else callback(new Error("Only .md and .txt files are supported."));
  },
});

export function createApp(store: Store) {
  const app = express();
  app.use(express.json({ limit: "64kb" }));

  const parseFile = (file: Express.Multer.File) => {
    const content = file.buffer.toString("utf8").replace(/\0/g, "");
    if (!content.trim()) throw new Error(`${file.originalname} is empty.`);
    return { name: file.originalname, content };
  };

  app.get("/api/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.get("/api/documents", (request, response) => {
    response.json(
      store.list({
        filename: String(request.query.filename ?? ""),
        tag: String(request.query.tag ?? ""),
      }),
    );
  });

  app.get("/api/documents/:id", (request, response) => {
    const document = store.get(Number(request.params.id));
    if (!document) return response.status(404).json({ error: "Document not found." });
    response.json(document);
  });

  app.post("/api/documents", upload.single("file"), (request, response) => {
    if (!request.file) return response.status(400).json({ error: "Choose a file to import." });
    try {
      const file = parseFile(request.file);
      response.status(201).json(store.add(file.name, file.content));
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "Import failed." });
    }
  });

  app.post("/api/documents/batch", upload.array("files", 50), (request, response) => {
    const files = request.files as Express.Multer.File[] | undefined;
    if (!files?.length) {
      return response.status(400).json({ error: "Choose at least one file to import." });
    }
    try {
      const items = files.map(parseFile);
      const documents = store.addMany(items);
      response.status(201).json({ imported: documents.length, documents });
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "Import failed." });
    }
  });

  app.patch("/api/documents/:id/tags", (request, response) => {
    try {
      const document = store.setTags(Number(request.params.id), request.body.tags);
      if (!document) return response.status(404).json({ error: "Document not found." });
      response.json(document);
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "Invalid tags." });
    }
  });

  app.get("/api/tags", (_request, response) => {
    response.json(store.listTags());
  });

  app.delete("/api/documents/:id", (request, response) => {
    if (!store.remove(Number(request.params.id))) {
      return response.status(404).json({ error: "Document not found." });
    }
    response.status(204).send();
  });

  app.get("/api/search", (request, response) => {
    const query = String(request.query.q ?? "").trim();
    if (!query) return response.json([]);
    try {
      response.json(
        store.search(query, {
          filename: String(request.query.filename ?? ""),
          tag: String(request.query.tag ?? ""),
        }),
      );
    } catch {
      response.status(400).json({ error: "Use words or a quoted phrase to search." });
    }
  });

  app.use((error: Error, _request: express.Request, response: express.Response, next: express.NextFunction) => {
    void next;
    if (error instanceof MulterError) {
      const message =
        error.code === "LIMIT_FILE_SIZE"
          ? "File too large. Maximum size is 5 MB."
          : error.code === "LIMIT_FILE_COUNT"
            ? "Import at most 50 files at a time."
            : "File upload failed.";
      return response.status(400).json({ error: message });
    }
    if (error.message === "Only .md and .txt files are supported.") {
      return response.status(400).json({ error: error.message });
    }
    console.error("Unhandled API error:", error);
    response.status(500).json({ error: "The request could not be completed." });
  });

  return app;
}
