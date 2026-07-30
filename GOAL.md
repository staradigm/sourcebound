# Sourcebound MVP Execution Goal

**Status:** Complete as of `v0.1.0` on 2026-07-30.

## Objective

Finish and publicly release the Sourcebound MVP as a trustworthy local-first document
search tool. Work proceeds in measured implementation and review loops recorded in
`LOG.md`; it does not expand into post-MVP features.

## In scope

1. Close every acceptance criterion in `docs/PRD.md`.
2. Add API integration coverage for import, validation, search, retrieval, and deletion.
3. Add keyboard behavior and automated accessibility checks for the primary workflow.
4. Record a reproducible 1,000-document search latency benchmark.
5. Resolve all independently reported critical and high-severity findings.
6. Publish a versioned GitHub release after local and CI verification pass.

PDF ingestion, semantic search, generated answers, sync, and native packaging remain
outside this goal.

## Execution loop

Each iteration follows the same procedure:

1. **Inspect:** Review the previous log entry, current diff, CI, and open findings.
2. **Implement:** Make the smallest coherent change that closes one or more gates.
3. **Verify:** Run focused tests, then the complete local quality gate.
4. **Review:** Assign independent agents to code/security, UX/accessibility, and
   product/release checks. Agents must cite files, lines, and reproducible evidence.
5. **Remediate:** Fix critical and high findings immediately. Record medium and low
   findings with a disposition.
6. **Record:** Append commands, results, decisions, findings, and the next action to
   `LOG.md`.

No iteration may be marked complete based only on implementation. It must include
verification evidence.

## Quality gates

All of the following must pass:

- `npm ci`
- `npm run lint`
- `npm test`
- `npm run build`
- `npm audit`
- API integration tests cover success, invalid type, empty file, malformed search,
  retrieval, deletion, and post-delete search behavior.
- Automated accessibility checks report no serious or critical violations in the
  import-search-open workflow.
- The primary workflow is keyboard operable at 320 px and 1440 px viewport widths.
- The benchmark indexes 1,000 representative notes and reports p95 search latency below
  500 ms on the development machine.
- GitHub Actions passes on the release commit.
- The public GitHub release exposes the verified commit, changelog, and run instructions.
- Independent review has no unresolved critical or high findings.

## Deployment definition

Sourcebound's core workflow must not be hosted as a shared cloud service because that
would send user documents away from their machine and contradict the PRD. For this MVP,
deployment means:

- a public repository;
- a green protected release commit;
- a tagged GitHub release with reproducible local run instructions; and
- a locally verified application health endpoint.

Cloud hosting can be reconsidered only after an architecture explicitly isolates data on
the user's device.

## Stop condition

Stop the loop and mark the goal complete only when every quality gate above passes and
all in-scope checklist items are complete.

Mark the goal blocked only when the same external blocker prevents meaningful progress
for three consecutive documented iterations. A blocker must identify the owner, the
required external action, and the evidence from all three attempts. Test failures,
review findings, difficult implementation, and fixable environment problems are not
blockers.

## Change control

New ideas discovered during execution go into `docs/PLAN.md` after Milestone 1. They do
not enlarge this goal unless an existing acceptance criterion cannot be met without
them.
