import express from "express";
import multer, { MulterError } from "multer";
import type { Store } from "./store.js";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
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

  app.get("/api/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.get("/api/documents", (_request, response) => {
    response.json(store.list());
  });

  app.get("/api/documents/:id", (request, response) => {
    const document = store.get(Number(request.params.id));
    if (!document) return response.status(404).json({ error: "Document not found." });
    response.json(document);
  });

  app.post("/api/documents", upload.single("file"), (request, response) => {
    if (!request.file) return response.status(400).json({ error: "Choose a file to import." });
    const content = request.file.buffer.toString("utf8").replace(/\0/g, "");
    if (!content.trim()) return response.status(400).json({ error: "The file is empty." });
    response.status(201).json(store.add(request.file.originalname, content));
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
      response.json(store.search(query));
    } catch {
      response.status(400).json({ error: "Use words or a quoted phrase to search." });
    }
  });

  app.use((error: Error, _request: express.Request, response: express.Response, next: express.NextFunction) => {
    void next;
    if (error instanceof MulterError) {
      const message = error.code === "LIMIT_FILE_SIZE" ? "File too large. Maximum size is 5 MB." : "File upload failed.";
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
