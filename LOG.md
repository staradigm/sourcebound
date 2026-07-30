# Sourcebound Execution Log

This is an append-only record of the execution loop defined in `GOAL.md`.

## Iteration 0 - Baseline and contract

**Date:** 2026-07-30

**Starting state**

- Public repository: `https://github.com/staradigm/sourcebound`
- Branch: `main`
- Baseline commit: `70af740`
- GitHub CI: passing
- Existing implementation: text/Markdown import, SQLite persistence and FTS5 search,
  source reader, deletion, responsive desktop/mobile UI
- Open Milestone 1 items: API integration tests, keyboard/accessibility checks,
  1,000-document benchmark

**Decisions**

- Keep the loop bounded to MVP requirements.
- Treat a GitHub release as deployment; do not host private document processing.
- Use three independent review perspectives before release: code/security,
  UX/accessibility, and product/release readiness.
- Require critical and high findings to be resolved; explicitly disposition lower
  severity findings.

**Baseline evidence**

- `npm run lint`: pass
- `npm test`: 2 tests pass
- `npm run build`: pass
- `npm audit`: zero vulnerabilities
- GitHub Actions run `30578402554`: pass

**Next action**

Implement missing test, accessibility, and benchmark gates, then begin independent
review.

## Iteration 1 - Missing quality gates

**Date:** 2026-07-30

**Implemented**

- Added API integration coverage for the full document lifecycle and validation errors.
- Added UI workflow and keyboard-order tests using jsdom and Testing Library.
- Added an axe-core scan for serious and critical accessibility violations.
- Added visible keyboard focus, polite status announcements, and Escape-to-clear search.
- Replaced FTS excerpt HTML injection with safe React text and `mark` nodes.
- Added a deterministic 1,000-document benchmark.

**Evidence**

- `npm test`: 3 files, 8 tests pass.
- `npm run lint`: pass.
- `npm run build`: pass.
- `npm run benchmark`: 1,000 documents, 100 searches, 3.635 ms p95, 500 ms target.
- `npm audit`: pending full iteration gate after independent review.

**Independent review dispatched**

- Code and security correctness reviewer.
- UX and accessibility reviewer.
- Product goal and release-readiness verifier.

**Next action**

Complete real-browser 320 px and 1440 px checks, triage independent findings, then fix
all critical and high-severity issues.

## Iteration 2 - Independent review remediation

**Date:** 2026-07-30

**Review findings**

- Code/security: no critical findings; one high finding that the API bound beyond
  loopback; medium findings for search races, stale results, Node version mismatch, and
  an in-memory benchmark; low findings for delete errors, marker collisions, and raw
  server errors.
- UX/accessibility: no critical findings; one high finding for three small-text contrast
  failures; medium findings for reader focus, live announcements, search races, and
  interactive elements nested in a label; low findings for touch targets and missing
  search pending state.
- Product/release: release stop because the candidate was uncommitted, CI omitted declared
  gates, viewport/pilot evidence was incomplete, no release existed, and the API privacy
  boundary was unenforced.

**Remediation**

- Forced API binding to `127.0.0.1` and added a real socket-address test.
- Darkened functional small text and restored axe color-contrast evaluation.
- Added abortable search, stale-result clearing, an accessible pending state, and separate
  result/open announcements.
- Focused the reader heading after opening a source and fixed search label structure.
- Increased compact icon targets and added delete network-error handling.
- Replaced delimiter-based client parsing with server-produced highlight offsets using
  per-query markers.
- Sanitized unexpected API errors and stabilized known upload errors.
- Raised and enforced the Node.js floor to 22.12.
- Changed the benchmark to use a temporary file database that is closed and reopened
  before measurement; recorded Node and platform metadata.
- Added persistence-across-reopen and health endpoint tests.
- Added lint, audit, and benchmark to GitHub Actions and verification documentation.

**Evidence**

- `npm test`: 4 files, 11 tests pass.
- `npm run lint`: pass.
- `npm run build`: pass.
- `npm run benchmark`: 1,000 documents, 100 searches, reopened file database,
  1.357 ms p95, 500 ms target.
- `npm audit`: zero vulnerabilities.
- `curl http://127.0.0.1:4318/api/health`: `{"status":"ok"}`.
- `ss -ltn '( sport = :4318 )'`: listener is `127.0.0.1:4318`.
- Chrome screenshots inspected at exactly 320x800 and 1440x900: no overlap,
  horizontal overflow, clipped controls, or unreadable source layout.

**Next action**

Commit the release candidate, obtain green CI on that exact commit, and have all three
review agents re-check the remediation before pilot UAT and release.

## Iteration 3 - Release-candidate verification

**Date:** 2026-07-30

**Candidate**

- Commit: `f9577de`
- GitHub Actions run: `30579559539`
- CI result: pass on `npm ci`, lint, 11 tests, build, disk benchmark, and audit.

**Independent re-review**

- Code/security: all prior findings fixed; no critical or high findings remain. One new
  low benchmark cleanup edge was accepted for immediate correction.
- UX/accessibility: high contrast issue and all prior medium findings fixed; no critical
  or high findings remain. One pending-state wording issue was accepted for immediate
  correction.
- Product/release: engineering gates pass; keyboard operation at both required viewport
  widths, pilot UAT, and final tag/release remained.

**Final polish**

- Made benchmark cleanup reliable even when database reopen fails.
- Added a visible “Searching sources” state so pending work is not presented as zero
  matches.
- Updated GitHub Actions from v4 to v5 to remove Node 20 action-runtime deprecation.
- Added a reproducible real-Chrome keyboard verifier.

**Browser keyboard evidence**

`npm run verify:keyboard` completed import-search-open through keyboard activation and
ran axe-core in real Chrome:

| Viewport | Workflow | Serious/critical axe violations |
| --- | --- | --- |
| 320x800 | pass | 0 |
| 1440x900 | pass | 0 |

**Next action**

Complete independent first-time pilot UAT, run the final clean-install gate, publish the
release commit, obtain green CI, and create the `v0.1.0` GitHub release.

## Iteration 4 - Pilot UAT and final gate

**Date:** 2026-07-30

**Independent pilot**

- Environment: headless Google Chrome, 1440x900.
- Fixture: a 171-byte Markdown note created outside the repository.
- Import: pass; the visible file picker added the named note to the library.
- Search: pass; the distinctive two-word query returned exactly one matching result.
- Open: pass; the reader announced “Source opened” and displayed the complete original
  Markdown from title through final line.
- Pilot-reported app hesitation or error: none.
- Screenshot evidence: `/tmp/pilot-uat-final.png`.

**Final local gate**

- `npm ci`: pass; 385 packages audited, zero vulnerabilities.
- `npm run lint`: pass.
- `npm test`: 4 files, 11 tests pass.
- `npm run build`: pass.
- `npm run benchmark`: reopened file database, 2.627 ms p95, 500 ms target.
- `npm audit`: zero vulnerabilities.
- `git diff --check`: pass.

**Stop-condition assessment**

- All PRD acceptance criteria: pass.
- API integration and persistence coverage: pass.
- Real-browser keyboard workflow at 320 px and 1440 px: pass.
- Serious/critical real-browser axe violations: zero.
- Independent critical/high findings: zero after re-review.
- Pilot import-search-open workflow: pass.
- Public repository and contribution documentation: present.
- Remaining actions: verify CI on the final release commit, tag it, and publish the
  GitHub release.

## Iteration 5 - Public release

**Date:** 2026-07-30

**Release evidence**

- Verified release commit: `ea9cdc1`.
- GitHub Actions run `30580259708`: pass on install, lint, tests, build, benchmark, and
  audit.
- Tag: `v0.1.0`.
- Public release: `https://github.com/staradigm/sourcebound/releases/tag/v0.1.0`.
- Release changelog and reproducible run instructions: present.
- Repository identity and commit attribution: `staradigm`.

**Final stop-condition result**

Every quality gate in `GOAL.md` passes. All in-scope Milestone 1 items are complete,
independent reviewers report no unresolved critical or high findings, pilot UAT passes,
and the verified release is public. The execution loop stops here. Later milestones
remain roadmap work and do not extend this completed MVP goal.

## Milestone 2, Iteration 0 - Retrieval scope

**Date:** 2026-07-30

**Starting state**

- Base release: `v0.1.0`.
- Main branch CI: passing at `6de565e`.
- Existing databases contain only the `documents` and `documents_fts` schema.

**Decisions**

- Deliver batch/folder import, tags, constrained search, ranking, and evaluation as
  `v0.2.0`.
- Keep schema changes additive and preserve all existing documents.
- Validate complete batches before writing any document.
- Normalize tags to lowercase user metadata; do not mutate document contents.
- Defer PDF extraction until page-level source locations have a dedicated contract.

**Stop condition**

Use the acceptance criteria in `docs/MILESTONE-2.md`, repeat implementation/review
cycles until all gates pass, then publish `v0.2.0`.

## Milestone 2, Iteration 1 - Metadata and retrieval

**Date:** 2026-07-30

**Implemented**

- Added additive `tags` and `document_tags` schema with cascade cleanup.
- Added normalized tag editing and global tag counts.
- Added atomic batch import for up to 50 Markdown/text files.
- Added browser file and folder selection controls.
- Added filename/tag filters to library listing and full-text search.
- Added safe user-query compilation for punctuation and quoted phrases.
- Added explicit filename weighting through FTS5 `bm25`.
- Added a versioned 10-document, 50-query retrieval dataset and recall@5 evaluator.
- Added filter, tag, batch atomicity, migration-compatible persistence, ranking, and
  evaluation coverage.

**Evidence**

- `npm test`: 5 files, 19 tests pass.
- `npm run lint`: pass.
- `npm run build`: pass.
- `npm run benchmark`: reopened 1,000-document database, 5.529 ms p95.
- `npm run eval:retrieval`: 50/50 hits, recall@5 1.0, target 0.9.
- `npm run verify:keyboard`: pass at 320 and 1440; zero serious/critical axe violations.
- `npm audit`: zero vulnerabilities.
- Live API: two-file batch import, tag normalization, and combined filename/tag search
  pass against the migrated on-disk database.
- Playwright viewports: no horizontal overflow at 320 or 1440.

**Next action**

Triage independent code/security, UI/accessibility, and release-readiness reviews; fix
all critical/high findings and disposition lower-severity findings before pilot UAT.

## Milestone 2, Iteration 2 - Review remediation

**Date:** 2026-07-30

**Independent findings**

- Code/security: no critical findings; release version and genuine v0.1 migration
  coverage were high blockers. Tag boundaries, batch rollback coverage, evaluator
  validity, and non-string tags required strengthening.
- UX/accessibility: no critical/high findings. Filtered-empty recovery, tag mutation
  state, import discoverability, touch targets, and accessible group relationships were
  medium/low findings.
- Release verification: stop pending mixed-folder behavior, broader automated coverage,
  credible distractors/rank metrics, metadata, exact-commit CI, and pilot evidence.

**Remediation**

- Bumped package and lockfile metadata to `0.2.0`; updated README and changelog.
- Added a real v0.1 schema/FTS fixture and verified document, search, tag, and reopen
  preservation after migration.
- Applied the 10-tag limit after normalization/deduplication and rejected non-string
  metadata.
- Added mixed-unsupported and 51-file batch rejection tests with zero stored rows.
- Folder selection now imports supported Markdown/text files and reports skipped files.
- Expanded evaluation from 10 to 50 documents with 40 overlapping distractors.
- Added dataset schema/invariant validation and negative tests.
- Added a 90% top-1 target alongside 90% recall@5.
- Added tag removal/persistence, combined UI filter/search, clear-filter query
  preservation, and mixed-folder UI coverage.
- Added visible file/folder labels, filtered-empty clearing, tag mutation locking and
  repeated announcements, larger mobile targets, and explicit filter/tag groups.

**Evidence**

- `npm test`: 5 files, 24 tests pass.
- `npm run lint`: pass.
- `npm run build`: pass.
- `npm run eval:retrieval`: recall@5 1.0; top-1 accuracy 0.98.
- Playwright 320/1440 filtered-empty state: no overflow; visible recovery action.

**Next action**

Run the complete clean-install gate, commit and push the exact candidate, obtain green
CI, then repeat all independent reviews before pilot UAT.

## Milestone 2, Iteration 3 - Candidate clearance

**Date:** 2026-07-30

**Candidate**

- Commit: `a023570`.
- GitHub Actions run `30586158111`: pass on install, lint, 24 tests, build, benchmark,
  retrieval evaluation, and audit.

**Independent re-review**

- Code/security: all prior high findings resolved; no critical/high blockers remain.
- UX/accessibility: all prior medium findings resolved or reduced to low polish; no
  critical/high blockers remain.
- Release verification: engineering clear to proceed to pilot.

**Residual hardening**

- Corrected the evaluation description and tightened nonempty/tag-element validation.
- Added exact 50-file acceptance, 32/33-character tag boundaries, and all-unsupported
  folder rejection tests.
- Documented the bounded in-memory batch-processing constraint.
- Added `/` to focus search from the reader, avoiding traversal through large libraries.

**Evidence**

- `npm test`: 5 files, 26 tests pass.
- `npm run eval:retrieval`: recall@5 1.0; top-1 accuracy 0.98.
- `npm run lint` and `npm run build`: pass.

**Next action**

Push the final pilot candidate, confirm exact-commit CI, then run independent UAT for a
mixed folder, batch result, tag add/remove, combined filters, query preservation, and
source open.
