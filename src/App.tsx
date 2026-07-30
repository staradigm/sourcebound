import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type InputHTMLAttributes,
} from "react";
import {
  BookOpenText,
  Filter,
  FilePlus2,
  FileText,
  FolderOpen,
  Plus,
  Search,
  ShieldCheck,
  Tag,
  Trash2,
  X,
} from "lucide-react";

type DocumentSummary = {
  id: number;
  name: string;
  size: number;
  createdAt: string;
  tags: string[];
};

type Document = DocumentSummary & { content: string };
type SearchResult = DocumentSummary & {
  excerpt: string;
  highlights: Array<[number, number]>;
};
type TagSummary = { name: string; count: number };

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
  const [filenameFilter, setFilenameFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [availableTags, setAvailableTags] = useState<TagSummary[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [tagBusy, setTagBusy] = useState(false);
  const tagBusyRef = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const readerHeading = useRef<HTMLHeadingElement>(null);

  const loadDocuments = useCallback(async () => {
    try {
      const parameters = new URLSearchParams();
      if (filenameFilter.trim()) parameters.set("filename", filenameFilter.trim());
      if (tagFilter) parameters.set("tag", tagFilter);
      const suffix = parameters.size ? `?${parameters}` : "";
      setDocuments(await readJson(await fetch(`/api/documents${suffix}`)));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load the library.");
    }
  }, [filenameFilter, tagFilter]);

  const loadTags = useCallback(async () => {
    try {
      setAvailableTags(await readJson(await fetch("/api/tags")));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load tags.");
    }
  }, []);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    void loadTags();
  }, [loadTags]);

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
        const parameters = new URLSearchParams({ q: query });
        if (filenameFilter.trim()) parameters.set("filename", filenameFilter.trim());
        if (tagFilter) parameters.set("tag", tagFilter);
        setResults(
          await readJson(
            await fetch(`/api/search?${parameters}`, {
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
  }, [filenameFilter, query, tagFilter]);

  useEffect(() => {
    if (selected) readerHeading.current?.focus();
  }, [selected]);

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;
      if (event.key === "/" && !editing) {
        event.preventDefault();
        searchInput.current?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  function announce(message: string) {
    setNotice("");
    window.setTimeout(() => setNotice(message), 0);
  }

  async function importFiles(files?: FileList | File[], folder = false) {
    if (!files?.length) return;
    const allFiles = Array.from(files);
    const supportedFiles = folder
      ? allFiles.filter((file) => /\.(md|txt)$/i.test(file.name))
      : allFiles;
    const skipped = allFiles.length - supportedFiles.length;
    if (!supportedFiles.length) {
      setError("The selected folder contains no Markdown or text files.");
      return;
    }
    const form = new FormData();
    for (const file of supportedFiles) {
      form.append("files", file, file.webkitRelativePath || file.name);
    }
    setBusy(true);
    announce(`Importing ${supportedFiles.length} ${supportedFiles.length === 1 ? "source" : "sources"}.`);
    try {
      const result = await readJson<{ imported: number; documents: Document[] }>(
        await fetch("/api/documents/batch", { method: "POST", body: form }),
      );
      await loadDocuments();
      await loadTags();
      setSelected(result.documents.at(-1) ?? null);
      setError("");
      announce(
        `Imported ${result.imported} ${result.imported === 1 ? "source" : "sources"}${
          skipped ? `; skipped ${skipped} unsupported ${skipped === 1 ? "file" : "files"}` : ""
        }.`,
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Import failed.");
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
      if (folderInput.current) folderInput.current.value = "";
    }
  }

  async function openDocument(id: number) {
    try {
      setSelected(await readJson(await fetch(`/api/documents/${id}`)));
      announce("Source opened.");
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
      announce("Document removed.");
      await loadDocuments();
      await loadTags();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not remove the document.");
    }
  }

  async function updateTags(tags: string[]) {
    if (!selected || tagBusyRef.current) return false;
    tagBusyRef.current = true;
    setTagBusy(true);
    try {
      const document = await readJson<Document>(
        await fetch(`/api/documents/${selected.id}/tags`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tags }),
        }),
      );
      setSelected(document);
      await Promise.all([loadDocuments(), loadTags()]);
      announce("Tags updated.");
      setError("");
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update tags.");
      return false;
    } finally {
      tagBusyRef.current = false;
      setTagBusy(false);
    }
  }

  function addTag(event: FormEvent) {
    event.preventDefault();
    const tag = tagDraft.trim().toLowerCase();
    if (!tag || !selected) return;
    void updateTags([...selected.tags, tag]).then((updated) => {
      if (updated) setTagDraft("");
    });
  }

  const activeFilterCount = Number(Boolean(filenameFilter.trim())) + Number(Boolean(tagFilter));

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
            <div className="import-actions">
              <button
                className="icon-button primary"
                type="button"
                title="Import files"
                aria-label="Import files"
                aria-busy={busy}
                disabled={busy}
                onClick={() => fileInput.current?.click()}
              >
                <FilePlus2 size={19} />
                <span>{busy ? "Importing" : "Files"}</span>
              </button>
              <button
                className="icon-button"
                type="button"
                title="Import folder"
                aria-label="Import folder"
                aria-busy={busy}
                disabled={busy}
                onClick={() => folderInput.current?.click()}
              >
                <FolderOpen size={19} />
                <span>Folder</span>
              </button>
            </div>
            <input
              ref={fileInput}
              hidden
              multiple
              aria-label="Choose Markdown or text files"
              type="file"
              accept=".md,.txt,text/markdown,text/plain"
              onChange={(event) => void importFiles(event.target.files ?? undefined)}
            />
            <input
              ref={folderInput}
              hidden
              multiple
              aria-label="Choose a folder"
              type="file"
              accept=".md,.txt,text/markdown,text/plain"
              {...({ webkitdirectory: "" } as InputHTMLAttributes<HTMLInputElement>)}
              onChange={(event) => void importFiles(event.target.files ?? undefined, true)}
            />
          </div>

          <div className="search-row">
            <div className="search-box">
              <Search size={18} />
              <label className="sr-only" htmlFor="library-search">
                Search documents
              </label>
              <input
                id="library-search"
                ref={searchInput}
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
            <button
              className={`filter-button ${activeFilterCount ? "active" : ""}`}
              type="button"
              title="Search filters"
              aria-label={`Search filters${activeFilterCount ? `, ${activeFilterCount} active` : ""}`}
              aria-expanded={filtersOpen}
              aria-controls="search-filter-panel"
              onClick={() => setFiltersOpen((current) => !current)}
            >
              <Filter size={18} />
              {activeFilterCount > 0 && <span>{activeFilterCount}</span>}
            </button>
          </div>

          {filtersOpen && (
            <div
              className="filter-panel"
              id="search-filter-panel"
              role="group"
              aria-label="Search filters"
            >
              <label>
                Filename
                <input
                  value={filenameFilter}
                  onChange={(event) => setFilenameFilter(event.target.value)}
                  placeholder="Contains..."
                />
              </label>
              <label>
                Tag
                <select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
                  <option value="">All tags</option>
                  {availableTags.map((tag) => (
                    <option value={tag.name} key={tag.name}>
                      {tag.name} ({tag.count})
                    </option>
                  ))}
                </select>
              </label>
              {activeFilterCount > 0 && (
                <button
                  className="clear-filters"
                  type="button"
                  onClick={() => {
                    setFilenameFilter("");
                    setTagFilter("");
                  }}
                >
                  <X size={15} />
                  Clear filters
                </button>
              )}
            </div>
          )}

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
                      <small>
                        {formatSize(item.size)}
                        {item.tags.length > 0 && ` · ${item.tags.join(", ")}`}
                      </small>
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
                {searching ? <Search size={24} /> : activeFilterCount ? <Filter size={24} /> : <FileText size={24} />}
                <p>
                  {searching
                    ? "Searching sources"
                    : query
                      ? "No matching passages"
                      : activeFilterCount
                        ? "No sources match these filters"
                        : "No sources yet"}
                </p>
                <span>
                  {searching
                    ? "Checking every indexed passage."
                    : query
                      ? "Try another word or phrase."
                      : activeFilterCount
                        ? "Clear the filters to return to the full library."
                        : "Import a Markdown or text file to begin."}
                </span>
                {!searching && !query && activeFilterCount > 0 && (
                  <button
                    className="empty-clear"
                    type="button"
                    onClick={() => {
                      setFilenameFilter("");
                      setTagFilter("");
                    }}
                  >
                    <X size={15} />
                    Clear filters
                  </button>
                )}
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
              <div className="tag-editor" role="group" aria-label="Document tags">
                <Tag size={16} />
                <div className="tag-list">
                  {selected.tags.map((tag) => (
                    <span className="tag-chip" key={tag}>
                      {tag}
                      <button
                        type="button"
                        aria-label={`Remove tag ${tag}`}
                        disabled={tagBusy}
                        onClick={() => void updateTags(selected.tags.filter((item) => item !== tag))}
                      >
                        <X size={13} />
                      </button>
                    </span>
                  ))}
                </div>
                <form onSubmit={addTag}>
                  <label className="sr-only" htmlFor="new-tag">
                    Add tag
                  </label>
                  <input
                    id="new-tag"
                    value={tagDraft}
                    maxLength={32}
                    disabled={tagBusy}
                    onChange={(event) => setTagDraft(event.target.value)}
                    placeholder="Add tag"
                  />
                  <button type="submit" title="Add tag" aria-label="Add tag" disabled={tagBusy}>
                    <Plus size={15} />
                  </button>
                </form>
              </div>
              <pre className="document-content">{selected.content}</pre>
            </>
          ) : (
            <div className="reader-empty">
              <BookOpenText size={38} />
              <h2>Select a source</h2>
              <p>Open a document to inspect its complete original text.</p>
              <button className="import-button" onClick={() => fileInput.current?.click()}>
                <FilePlus2 size={18} />
                Import sources
              </button>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
