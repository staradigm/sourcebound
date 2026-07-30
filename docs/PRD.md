# Sourcebound MVP Product Requirements

## Summary

Sourcebound is a local-first document search workspace. It helps people retrieve exact
passages from their own notes without uploading private source material to a third party.

## Problem

Personal knowledge is spread across files and difficult to retrieve. Cloud AI tools can
answer questions, but often obscure which passage supports an answer and require users
to surrender their documents. The first product risk is retrieval quality, not text
generation. The MVP therefore proves import, indexing, search, and source inspection.

## Target user

Researchers, developers, students, and writers with a folder of Markdown or text notes
who need to find a remembered fact and verify it against the original wording.

## MVP outcome

A user can build and search a private local library in under two minutes, then open the
complete source behind any matching passage.

## User stories

1. As a user, I can import a `.md` or `.txt` file up to 5 MB.
2. As a user, I can see every imported document in a library.
3. As a user, I can search all document contents and see highlighted excerpts.
4. As a user, I can open the complete original source from a result.
5. As a user, I can remove a document and its search index data.
6. As a privacy-conscious user, I can use all MVP features without an external service.

## Acceptance criteria

- Imported documents persist in a local SQLite database across restarts.
- Search results appear within 500 ms for a library of 1,000 typical notes.
- A result displays its filename and a passage containing highlighted matching terms.
- Search syntax failures return actionable feedback without crashing the app.
- Unsupported and empty files are rejected.
- Deleting a document removes it from the library and subsequent search results.
- Desktop and mobile layouts remain usable down to a 320 px viewport.
- Core indexing and deletion behavior is covered by automated tests.

## Non-goals

- PDF, DOCX, image, or OCR ingestion
- Accounts, synchronization, collaboration, or hosted storage
- Embedding-based semantic search
- LLM-generated answers
- Rich Markdown rendering or editing
- Folder watching and bulk import
- Native desktop packaging

## Success metrics

- At least 80% of five pilot users can import and find a supplied passage unassisted.
- Zero document contents leave the machine during the core workflow.
- Search returns the expected source in the top five for 90% of a 50-query test set.
- No data loss across restart, deletion, and failed-import test scenarios.

## Risks and mitigations

| Risk | MVP mitigation |
| --- | --- |
| FTS syntax surprises users | Debounced search and actionable errors |
| Binary or oversized files exhaust memory | Extension allowlist and 5 MB limit |
| “Local-first” is confused with browser-only | State that the local API and SQLite file remain on-device |
| Generated answers distract from weak retrieval | Defer generation until retrieval evaluation passes |

## Release boundary

MVP is complete when all acceptance criteria pass locally and in CI, the repository has
public contribution documentation, and one pilot user completes the import-search-open
workflow.
