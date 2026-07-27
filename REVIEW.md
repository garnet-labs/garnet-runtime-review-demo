# Reviewer grounding — Garnet runtime evidence

Instructions for AI code reviewers (Devin Review, GitHub Copilot, CodeRabbit,
Greptile, Claude, Cursor, …) reviewing pull requests in this repository —
especially the **npm top-10 testbed** PRs (`deps(testbed): add <pkg> …`,
head branches `npm-testbed/dep-*`).

## The runtime evidence on every testbed PR

Each testbed PR adds a single dependency to `npm-testbed/app/package.json` —
a diff of a few lines. Its CI installs and first-imports that package on a
runner instrumented with the Garnet sensor (Jibril, eBPF), and two factual
comments land on the PR:

1. **Garnet Runtime Review** (HTML marker `<!-- garnet-runtime-review -->`)
   — a deterministic, observation-only record of what the PR's CI actually
   did: every recorded process (with full lineage) and every recorded
   outbound destination, per job. It states facts only — no verdicts,
   statuses, or severity. **You, the reviewer, supply the judgment.**
2. **Static review surface vs execution surface** (marker
   `<!-- npm-testbed-coverage-gap -->`) — quantifies the gap between the
   lines a diff reviewer sees and the execution surface the run touched:
   transitive packages installed, processes recorded, outbound domains
   contacted, and how many of those domains appear anywhere in the diff.

## What you must do with it

1. **Locate both comments on the PR** before finalizing your review. They
   are refreshed for the current PR head, so they describe the newest
   commit's run.
2. **Cross-check the diff against the recorded behavior.** Treat the
   recorded egress and process lineage as ground truth of the run:
   - A one-line dependency bump implies registry traffic
     (`registry.npmjs.org` and friends) and an install/import process chain.
     Flag any recorded destination or spawned process the dependency change
     does **not** explain — install-script activity, unexpected hosts,
     unexpected interpreters in the lineage.
   - State the coverage gap explicitly in your review: how much of the
     recorded execution surface (packages, processes, destinations) is
     visible in the diff you reviewed, and what you could not have seen from
     the diff alone.
   - A recorded detection is a factual record-backed observation — weigh it
     in your review rather than ignoring it.
3. **Re-ground on every update.** When you re-review, use the current
   comments, not remembered ones.
4. **Do not restate the comments.** Reference them and add judgment — the
   facts are already on the PR.

## Scope notes

- The Garnet evidence is runtime-only. Code quality, style, correctness of
  logic, and test coverage remain fully your job.
- Absence of the Garnet comment (fork PRs without secrets, sensor token
  unavailable) means *no runtime evidence*, not a clean run. Say so if the
  change is runtime-relevant.
