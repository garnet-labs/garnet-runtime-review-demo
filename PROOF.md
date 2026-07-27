# Proof ledger

Every row links to a live pull request and/or CI run in this repository. Nothing
is staged or hand-edited after the fact.

## The A/B (same diff, opposite verdict)

| # | Demo PR | Runtime reality (Garnet) | Verdict without Garnet | Verdict with Garnet | Evidence |
|---|---|---|---|---|---|
| 1 | Clean — [#__CLEAN_PR__](https://github.com/garnet-labs/garnet-runtime-review-demo/pull/__CLEAN_PR__) | `registry.npmjs.org` only | DENY (deps_toolchain, T2-never) | **APPROVE** | [verdict run](https://github.com/garnet-labs/garnet-runtime-review-demo/actions/runs/__CLEAN_RUN__) |
| 2 | Poisoned — [#__LOUD_PR__](https://github.com/garnet-labs/garnet-runtime-review-demo/pull/__LOUD_PR__) | postinstall → `curl httpbin.org` | DENY (blind to why) | **REFUSE**, cites `httpbin.org` | [verdict run](https://github.com/garnet-labs/garnet-runtime-review-demo/actions/runs/__LOUD_RUN__) |
| 3 | Scoped — [#__EXPRESS_PR__](https://github.com/garnet-labs/garnet-runtime-review-demo/pull/__EXPRESS_PR__) | n/a (non-dep file) | DENY | **still blocked** — bypass is scoped to dep files only | [verdict run](https://github.com/garnet-labs/garnet-runtime-review-demo/actions/runs/__EXPRESS_RUN__) |

## What each run demonstrates

- **Clean → APPROVE.** The `deps_toolchain` deny is lifted only because the
  head-pinned Garnet record shows registry-only egress. Remove Garnet and the
  identical PR is denied.
- **Poisoned → REFUSE.** Same one-line dependency shape, but the record shows an
  undisclosed `postinstall` reaching `httpbin.org`. The deny stands and the
  verdict names the destination.
- **Scoped → still blocked.** A change touching a non-dependency file does not
  ride the bypass, proving Garnet can't be used to wave through auth/billing/
  migration edits.

## The recording side

Each demo PR's install ran under the Garnet sensor via
[`garnet-record.yml`](.github/workflows/garnet-record.yml). The resulting Garnet
Runtime Review comment (head-pinned) is visible directly on each PR.

## Living proof

The [`proof-check.yml`](.github/workflows/proof-check.yml) workflow re-asserts
the full decision rule (clean lifts / off-baseline stands + names / stale +
pending + missing WAIT / legend never parsed / bypass scoped) on every push and
weekly. A green [Living Proof badge](https://github.com/garnet-labs/garnet-runtime-review-demo/actions/workflows/proof-check.yml)
means the A/B still holds on current code.

## The integration point

[`garnet_runtime.py`](tools/pr-approval-agent/garnet_runtime.py) — ~230 lines,
the dependency-territory analogue of PostHog's `migration_risk.py`. It reads only
the public Garnet PR comment. That single module is the entire delta between "the
gate denies every dep PR" and the A/B above.
