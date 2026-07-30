# Milestone 2: Trustworthy Retrieval

## Release slice

Version `0.2.0` makes larger local libraries manageable without adding cloud services or
generated answers. It adds batch ingestion, user-owned metadata, constrained search,
and a repeatable retrieval-quality gate.

PDF extraction and page-level citations remain the next slice of Milestone 2. They are
excluded from `0.2.0` so source-location semantics are not mixed into the metadata
release.

## User stories

1. I can import multiple Markdown and text files in one operation.
2. I can select a folder and import its supported files.
3. I can add and remove tags without changing the original document.
4. I can constrain the library and search results by filename and tag.
5. I can see active filters and clear them without clearing my search text.
6. I can trust that filename matches rank ahead of incidental body matches.

## Acceptance criteria

- A batch accepts up to 50 files, each no larger than 5 MB.
- Batch validation is atomic: an invalid or empty file prevents every file in that batch
  from being stored.
- Folder selection imports supported files through the same batch endpoint.
- Tags are normalized to lowercase, trimmed, unique per document, limited to 10 per
  document, and limited to 32 characters each.
- Existing `0.1.0` databases open without data loss and receive the additive tag schema.
- Library listing and full-text search accept filename and tag filters together.
- Filename matches receive an explicit FTS ranking boost.
- A versioned 50-query evaluation set achieves at least 90% expected-source recall@5.
- All new API behavior, schema persistence, UI workflows, and evaluation logic have
  automated coverage.
- Local-first, loopback-only, keyboard, responsive, audit, and CI gates continue to pass.

## Operational constraint

Batch uploads use in-memory multipart processing. The enforced maximum is 50 files at
5 MB each, so a deliberately maximal local request can temporarily consume roughly
250 MB plus decoding and database copies. The API remains loopback-only; streaming
staging is a future hardening item.

## Non-goals

- PDF/DOCX/OCR ingestion
- Automatic or AI-generated tags
- Nested tag taxonomies
- Semantic/vector search
- Accounts, sync, or collaborative libraries

## Stop condition

Release `v0.2.0` only after every acceptance criterion passes, independent reviewers
report no unresolved critical/high findings, CI is green on the release commit, and a
pilot completes batch-import, tag, filtered-search, and source-open.
