# Proof ledger

Every row links to a live pull request and/or CI run in this repository. Nothing
is staged or hand-edited after the fact.

## The A/B (same diff, opposite verdict)

| # | Demo PR | Runtime reality (Garnet) | Verdict without Garnet | Verdict with Garnet | Evidence |
|---|---|---|---|---|---|
| 1 | Clean — [#1](https://github.com/garnet-labs/garnet-runtime-review-demo/pull/1) | `registry.npmjs.org` only | DENY (deps_toolchain, T2-never) | **APPROVE** | [verdict run](https://github.com/garnet-labs/garnet-runtime-review-demo/actions/runs/30305816428) |
| 2 | Poisoned — [#2](https://github.com/garnet-labs/garnet-runtime-review-demo/pull/2) | postinstall → `curl httpbin.org` | DENY (blind to why) | **REFUSE**, cites `httpbin.org` | [verdict run](https://github.com/garnet-labs/garnet-runtime-review-demo/actions/runs/30305817810) |
| 3 | Scoped — [#3](https://github.com/garnet-labs/garnet-runtime-review-demo/pull/3) | clean dep install + an `auth` file | DENY (deps + auth) | **still blocked** — deps deny lifted, `auth` deny stands | [verdict run](https://github.com/garnet-labs/garnet-runtime-review-demo/actions/runs/30305819203) |
| 6 | Transitive — [#6](https://github.com/garnet-labs/garnet-runtime-review-demo/pull/6) | 2-deep transitive postinstall → `api.ipify.org`, `ip-api.com`, `httpbin.org` (**not in diff**) | DENY (and a diff-only reviewer sees nothing to flag) | **WITHHELD** — deny stands, all 3 transitive hosts named | [verdict run](https://github.com/garnet-labs/garnet-runtime-review-demo/actions/runs/30305820748) · [record run](https://github.com/garnet-labs/garnet-runtime-review-demo/actions/runs/30305397518) |

## What each run demonstrates

- **Clean → APPROVE.** The `deps_toolchain` deny is lifted only because the
  head-pinned Garnet record shows registry-only egress. Remove Garnet and the
  identical PR is denied.
- **Poisoned → REFUSE.** Same one-line dependency shape, but the record shows an
  undisclosed `postinstall` reaching `httpbin.org`. The deny stands and the
  verdict names the destination.
- **Scoped → still blocked.** A change touching a non-dependency file does not
  ride the bypass, proving Garnet can't be used to wave through auth/billing/
  migration edits. The verdict's grounding line shows the deps deny lifted while
  the `auth` deny remains.
- **Transitive → WITHHELD.** The most realistic case: the PR diff adds only a
  top-level `chart-helpers` dependency (a clean-looking 45-line manifest +
  lockfile). The egress lives two levels down (`chart-helpers → date-fmt →
  metrics-beacon`) in a bundled `postinstall` that never appears in the diff, so
  a diff-only or static reviewer passes it. Garnet records the install regardless
  and the gate withholds the bypass, naming all three transitive destinations as
  the evidence — head-pinned to the PR commit.

## Deterministic vs LLM verdicts

Every verdict linked above runs in **deterministic-gate mode** — no LLM key is
configured on this public repo, so the result depends only on the gates plus the
head-pinned Garnet record. That is deliberate: the runtime grounding (the
"Runtime evidence (Garnet)" block in each verdict comment) is what flips the
outcome, and it is fully reproducible by anyone. The full natural-language LLM
reviewer lane activates automatically once an `ANTHROPIC_API_KEY` repo secret is
added — the same engine, now writing the verdict in prose and citing the recorded
hosts. The runtime signal feeds both lanes identically.

## The recording side

Each demo PR's install ran under the Garnet sensor via
[`garnet-record.yml`](.github/workflows/garnet-record.yml). The resulting Garnet
Runtime Review comment (head-pinned) is visible directly on each PR.

## Living proof

The [`proof-check.yml`](.github/workflows/proof-check.yml) workflow re-asserts
the full decision rule (clean lifts / off-baseline stands + names / stale +
pending + missing WAIT / legend never parsed / bypass scoped / transitive multi-
host caught + all named / grounding text says WITHHELD vs APPLIED) on every push
and weekly — 10 tests. A green [Living Proof badge](https://github.com/garnet-labs/garnet-runtime-review-demo/actions/workflows/proof-check.yml)
means the A/B still holds on current code.

## The integration point

[`garnet_runtime.py`](tools/pr-approval-agent/garnet_runtime.py) — ~230 lines,
the dependency-territory analogue of PostHog's `migration_risk.py`. It reads only
the public Garnet PR comment. That single module is the entire delta between "the
gate denies every dep PR" and the A/B above.
