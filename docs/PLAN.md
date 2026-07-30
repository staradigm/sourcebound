# Delivery Plan

## Milestone 1: Searchable local library (complete)

- [x] Define MVP scope, user stories, acceptance criteria, and success metrics.
- [x] Create React workspace and local HTTP API.
- [x] Persist Markdown and text files in SQLite.
- [x] Index content with SQLite FTS5.
- [x] Build import, library, search, reader, error, empty, and delete states.
- [x] Add focused store tests.
- [x] Add API integration tests.
- [x] Add keyboard navigation and accessibility checks.
- [x] Run a 1,000-document latency benchmark.

## Milestone 2: Trustworthy retrieval

- [x] Add atomic multi-file and folder import.
- [x] Add normalized document tags.
- [x] Add filename and tag filters.
- [x] Define a versioned 50-query retrieval evaluation dataset.
- [x] Boost filename matches and verify recall@5.
- [ ] Release `v0.2.0`.
- [ ] Add PDF ingestion with page-level source locations in the next release slice.

## Milestone 3: Cited answers

- Add an optional model provider interface.
- Generate only from retrieved passages.
- Link every answer sentence to an exact passage.
- Refuse unsupported answers.
- Support a fully local model configuration.

## Milestone 4: Distribution

- Package as a desktop application.
- Add export, backup, and restore.
- Document database migrations.
- Publish signed releases.
