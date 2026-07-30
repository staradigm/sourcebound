# Sourcebound

Local-first search for your own sources. Import Markdown or text files, find exact
passages with SQLite full-text search, and inspect the original source without sending
document contents to an external service.

## Status

Sourcebound is an early public project. Version 0.2 supports multi-file and folder
import, persistent local storage, normalized tags, filename/tag filters, full-text
search, source reading, and deletion.
See the [product requirements](docs/PRD.md) and [delivery plan](docs/PLAN.md).

## Run locally

Requirements: Node.js 22.12 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. The API runs at `http://localhost:4318`, and local data is
stored in `data/sourcebound.db`.

## Verify

```bash
npm ci
npm run lint
npm test
npm run build
npm run benchmark
npm run eval:retrieval
npm audit
```

With the development server running and Google Chrome installed:

```bash
npm run verify:keyboard
```

This performs the import-search-open workflow entirely through keyboard activation at
320 px and 1440 px, then runs axe-core in the real browser.

The versioned retrieval gate is defined in
[`eval/retrieval-v1.json`](eval/retrieval-v1.json). It uses 50 documents and 50 queries
and enforces both recall@5 and top-1 accuracy targets.

## Privacy model

The MVP has no authentication, analytics, model API, or cloud sync. The React client
talks to a server running on the same machine, and that server stores content in a local
SQLite database. Do not expose the development API to a public network.

## Contributing

Issues and pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before
starting substantial work.

## License

[MIT](LICENSE)
