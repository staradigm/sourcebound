# Changelog

All notable changes to Sourcebound are documented here.

## 0.1.0 - 2026-07-30

### Added

- Local Markdown and text file import with a 5 MB limit.
- Persistent on-device SQLite document library.
- SQLite FTS5 search with highlighted source excerpts.
- Complete source reader and local deletion workflow.
- Responsive layouts for mobile and desktop.
- Keyboard-operated import-search-open workflow with reader focus management.
- API, persistence, socket binding, UI accessibility, and store tests.
- Reproducible 1,000-document disk benchmark.
- Public PRD, delivery plan, contribution guide, execution goal, and audit log.

### Security and privacy

- API binds only to `127.0.0.1`.
- Imported excerpt content renders through escaped React text nodes and structured
  highlight offsets.
- Unexpected server errors return sanitized messages.
- The MVP has no analytics, cloud sync, authentication service, or model provider.

### Verification

- Independent code/security and UX/accessibility re-reviews found no unresolved critical
  or high-severity issues.
- Real-Chrome keyboard and axe checks pass at 320 px and 1440 px.
- GitHub Actions runs install, lint, tests, build, benchmark, and dependency audit.
