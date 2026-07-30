import { useCallback, useEffect, useRef, useState } from "react";
import {
  BookOpenText,
  FilePlus2,
  FileText,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";

type DocumentSummary = {
  id: number;
  name: string;
  size: number;
  createdAt: string;
};

type Document = DocumentSummary & { content: string };
type SearchResult = DocumentSummary & {
  excerpt: string;
  highlights: Array<[number, number]>;
};

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Something went wrong.");
  return data;
}

function formatSize(bytes: number) {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

function isSearchResult(item: DocumentSummary | SearchResult): item is SearchResult {
  return "excerpt" in item;
}

function HighlightedExcerpt({
  excerpt,
  highlights,
}: Pick<SearchResult, "excerpt" | "highlights">) {
  const finalHighlightEnd = highlights.at(-1)?.[1] ?? 0;
  return (
    <span className="excerpt">
      {highlights.flatMap(([start, end], index) => [
        <span key={`text-${index}`}>
          {excerpt.slice(index === 0 ? 0 : highlights[index - 1][1], start)}
        </span>,
        <mark key={`mark-${index}`}>{excerpt.slice(start, end)}</mark>,
      ])}
      <span>{excerpt.slice(finalHighlightEnd)}</span>
    </span>
  );
}

export function App() {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [selected, setSelected] = useState<Document | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const readerHeading = useRef<HTMLHeadingElement>(null);

  const loadDocuments = useCallback(async () => {
    try {
      setDocuments(await readJson(await fetch("/api/documents")));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load the library.");
    }
  }, []);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      if (!query.trim()) {
        setResults([]);
        setSearching(false);
        return;
      }
      setResults([]);
      setNotice("");
      setSearching(true);
      try {
        setResults(
          await readJson(
            await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
              signal: controller.signal,
            }),
          ),
        );
        setError("");
      } catch (reason) {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setResults([]);
        setError(reason instanceof Error ? reason.message : "Search failed.");
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 180);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    if (selected) readerHeading.current?.focus();
  }, [selected]);

  async function importFile(file?: File) {
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    setBusy(true);
    try {
      const document = await readJson<Document>(
        await fetch("/api/documents", { method: "POST", body: form }),
      );
      await loadDocuments();
      setSelected(document);
      setError("");
      setNotice(`Imported ${document.name}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Import failed.");
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function openDocument(id: number) {
    try {
      setSelected(await readJson(await fetch(`/api/documents/${id}`)));
      setNotice("Source opened.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not open the document.");
    }
  }

  async function removeDocument(id: number) {
    if (!window.confirm("Remove this document from your local library?")) return;
    try {
      const response = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not remove the document.");
      if (selected?.id === id) setSelected(null);
      setResults((current) => current.filter((result) => result.id !== id));
      setNotice("Document removed.");
      await loadDocuments();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not remove the document.");
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Sourcebound home">
          <BookOpenText size={22} strokeWidth={2.2} />
          <span>Sourcebound</span>
        </a>
        <div className="privacy-note">
          <ShieldCheck size={16} />
          Local workspace
        </div>
      </header>

      <section className="workspace">
        <aside className="library" aria-label="Document library">
          <div className="library-header">
            <div>
              <p className="eyebrow">Library</p>
              <h1>Your sources</h1>
            </div>
            <button
              className="icon-button primary"
              type="button"
              title="Import document"
              aria-label="Import document"
              aria-busy={busy}
              disabled={busy}
              onClick={() => fileInput.current?.click()}
            >
              <FilePlus2 size={19} />
            </button>
            <input
              ref={fileInput}
              hidden
              aria-label="Choose a Markdown or text file"
              type="file"
              accept=".md,.txt,text/markdown,text/plain"
              onChange={(event) => void importFile(event.target.files?.[0])}
            />
          </div>

          <div className="search-box">
            <Search size={18} />
            <label className="sr-only" htmlFor="library-search">
              Search documents
            </label>
            <input
              id="library-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setQuery("");
              }}
              placeholder="Search every source"
              aria-busy={searching}
            />
            {query && (
              <button type="button" title="Clear search" onClick={() => setQuery("")}>
                <X size={16} />
              </button>
            )}
          </div>

          <div className="document-list">
            {(query.trim() ? results : documents).map((item) => (
              <article
                className={`document-row ${selected?.id === item.id ? "active" : ""}`}
                key={item.id}
              >
                <button className="document-open" onClick={() => void openDocument(item.id)}>
                  <FileText size={19} />
                  <span>
                    <strong>{item.name}</strong>
                    {isSearchResult(item) ? (
                      <HighlightedExcerpt excerpt={item.excerpt} highlights={item.highlights} />
                    ) : (
                      <small>{formatSize(item.size)}</small>
                    )}
                  </span>
                </button>
                <button
                  className="remove-button"
                  type="button"
                  title={`Remove ${item.name}`}
                  aria-label={`Remove ${item.name}`}
                  onClick={() => void removeDocument(item.id)}
                >
                  <Trash2 size={16} />
                </button>
              </article>
            ))}

            {!(query.trim() ? results : documents).length && (
              <div className="empty-list">
                <FileText size={24} />
                <p>{query ? "No matching passages" : "No sources yet"}</p>
                <span>
                  {query
                    ? "Try another word or phrase."
                    : "Import a Markdown or text file to begin."}
                </span>
              </div>
            )}
          </div>
        </aside>

        <section className="reader" aria-label="Document reader">
          <p className="sr-only" role="status" aria-live="polite">
            {notice}
          </p>
          <p className="sr-only" role="status" aria-live="polite">
            {searching
              ? "Searching."
              : query.trim()
                ? `${results.length} search results.`
                : ""}
          </p>
          {error && (
            <div className="error-banner" role="alert">
              {error}
              <button type="button" onClick={() => setError("")} aria-label="Dismiss error">
                <X size={16} />
              </button>
            </div>
          )}

          {selected ? (
            <>
              <header className="reader-header">
                <div>
                  <p className="eyebrow">Source</p>
                  <h2 ref={readerHeading} tabIndex={-1}>
                    {selected.name}
                  </h2>
                </div>
                <span>{formatSize(selected.size)}</span>
              </header>
              <pre className="document-content">{selected.content}</pre>
            </>
          ) : (
            <div className="reader-empty">
              <BookOpenText size={38} />
              <h2>Select a source</h2>
              <p>Open a document to inspect its complete original text.</p>
              <button className="import-button" onClick={() => fileInput.current?.click()}>
                <FilePlus2 size={18} />
                Import a source
              </button>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
