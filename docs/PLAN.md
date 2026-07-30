# Delivery Plan

## Milestone 1: Searchable local library (in progress)

- [x] Define MVP scope, user stories, acceptance criteria, and success metrics.
- [x] Create React workspace and local HTTP API.
- [x] Persist Markdown and text files in SQLite.
- [x] Index content with SQLite FTS5.
- [x] Build import, library, search, reader, error, empty, and delete states.
- [x] Add focused store tests.
- [ ] Add API integration tests.
- [ ] Add keyboard navigation and accessibility checks.
- [ ] Run a 1,000-document latency benchmark.

## Milestone 2: Trustworthy retrieval

- Add folder and multi-file import.
- Add tags and filename filters.
- Define a versioned retrieval evaluation dataset.
- Improve passage segmentation and ranking.
- Add PDF ingestion with page-level source locations.

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
