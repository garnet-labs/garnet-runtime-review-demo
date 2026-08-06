# AGENTS.md — runtime context for AI agents and reviewers

This repository is a demonstration of **runtime-grounded PR review**: a real
merge gate that reads what a change *actually did* when it ran, not just what
its diff looks like. If you are an AI coding agent or an AI reviewer operating
in this repo, read this first.

## If you are REVIEWING a pull request

Follow [`REVIEW.md`](REVIEW.md) before finalizing any review. In short:

1. Find the **Garnet Runtime Review** comment (marker
   `<!-- garnet-runtime-review -->`) and, on testbed PRs, the **coverage-gap**
   comment (marker `<!-- npm-testbed-coverage-gap -->`). They are the kernel-
   recorded ground truth of what this PR's CI executed — every process lineage
   and every outbound destination. If your review context carries only the PR
   description, the same record is mirrored there verbatim between
   `<!-- garnet:evidence:begin -->` and `<!-- garnet:evidence:end -->`,
   head-bound via `<!-- garnet:commit <sha> -->`.
2. Cross-check the diff against that record. Your review must explicitly cite
   the runtime evidence: name any recorded destination or process the diff does
   not explain, or state that all recorded behaviour is explained by the change.
3. If the runtime comment is absent, say "no runtime evidence" — that is not the
   same as a clean run.

## If you are WRITING a change

Each demo PR adds exactly one dependency to `npm-testbed/app/package.json`. CI
installs and first-imports it under the Garnet sensor (Jibril, eBPF), so the
merge gate can see the install's real process tree and egress. Keep changes
small and single-purpose so the runtime signal stays legible.

## Repository layout

| Path | What it is |
|------|-----------|
| `tools/pr-approval-agent/` | The vendored PostHog "stamphog" review engine (see `NOTICE.md`). |
| `tools/pr-approval-agent/garnet_runtime.py` | The Garnet consumer — the one integration point. |
| `tools/owners/` | The ownership resolver the engine consumes. |
| `.stamphog/` | The declarative gate policy (`policy.yml`, `review-guidance.md`). |
| `npm-testbed/` | The real minimal workload that each demo PR changes. |
| `.github/workflows/garnet-record.yml` | Records the install under the Garnet sensor; posts the runtime evidence and mirrors it into the PR description. |
| `tools/garnet-evidence-mirror/` | Upserts the head-bound Garnet comment verbatim into the PR description for description-only reviewers. |
| `.github/workflows/stamphog-review.yml` | Runs the gate against a PR (Garnet-grounded). |
| `.github/workflows/proof-check.yml` | The living-proof suite — re-asserts the A/B on a schedule. |

## The one rule that matters

The gate hard-denies dependency/lockfile changes by default (they can pull in
third-party code). Garnet's runtime record is what lets a *clean* dependency PR
clear automatically — and what keeps a *poisoned* one denied, with the offending
destination named. Same diff; the runtime evidence is the only variable.
