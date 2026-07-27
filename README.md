# Runtime-grounded PR review — the demo

[![Living Proof](https://github.com/garnet-labs/garnet-runtime-review-demo/actions/workflows/proof-check.yml/badge.svg)](https://github.com/garnet-labs/garnet-runtime-review-demo/actions/workflows/proof-check.yml)

**A real merge gate, plus Garnet runtime evidence. Same diff — opposite verdict.**

This repo takes a real, unmodified PR-review merge gate (PostHog's open-source
"stamphog" engine — see [`NOTICE.md`](NOTICE.md)) and adds one thing: the gate
now reads a **kernel-recorded record of what the change actually did when its CI
ran**. Everything you can click below is a live pull request and a live CI run
in this repository — no mocks, no slides.

The whole point in one sentence: a merge gate that only sees a diff has to treat
every dependency bump the same. A gate that also sees the *runtime* can wave
through the clean one and stop the poisoned one — and tell you exactly why.

---

## The result, at a glance

Both demo PRs are the **same shape**: add one dependency (`ms@2.1.3`) with a
matching lockfile — the change stamphog hard-denies as `deps_toolchain`
("never auto-approve"). The only variable is what Garnet recorded at install
time.

| Demo PR | What the install actually did (Garnet) | Gate **without** Garnet | Gate **with** Garnet |
|---|---|---|---|
| **Clean** — [PR #__CLEAN_PR__](https://github.com/garnet-labs/garnet-runtime-review-demo/pull/__CLEAN_PR__) | hit `registry.npmjs.org` only | ❌ **DENY** → every dep PR dumped on a human | ✅ **APPROVE** — "install egress stayed within the registry baseline; no off-baseline destinations" ([run](https://github.com/garnet-labs/garnet-runtime-review-demo/actions/runs/__CLEAN_RUN__)) |
| **Poisoned** — [PR #__LOUD_PR__](https://github.com/garnet-labs/garnet-runtime-review-demo/pull/__LOUD_PR__) | postinstall hook ran `curl https://httpbin.org/get` | ❌ **DENY** — but blind to *why* | 🛑 **REFUSE** — "OFF-BASELINE egress to **httpbin.org**, not explained by the `ms@2.1.3` addition — supply-chain risk" ([run](https://github.com/garnet-labs/garnet-runtime-review-demo/actions/runs/__LOUD_RUN__)) |

Without Garnet the gate can't tell those two PRs apart. With Garnet, the clean
bump merges itself and the poisoned one is stopped with the destination named —
even though its diff looks like a trivial one-liner.

> Both demo PRs were opened by an **AI coding agent** (see each PR body). That is
> the real threat model: agents increasingly author dependency changes, and the
> diff alone can't tell you what the install will do on your runners.

---

## Why a diff-only gate can't win here

A one-line `"ms": "2.1.3"` addition and a poisoned `postinstall` that exfiltrates
at install time can look **identical** in review. The malicious behaviour lives
in transitive code and lifecycle scripts that execute in CI — off the diff. So a
responsible gate does the only safe thing it can: deny all dependency changes and
route them to a human. That is correct, and it is also exhausting — every clean
bump pays the same tax as a real threat.

Garnet closes the gap by recording the install with a kernel-level (eBPF) sensor
and posting the process lineage + egress as a **public PR comment**. The gate
consumes that record deterministically.

---

## The integration — what a harness team actually signs up for

- **No GitHub App install.** The gate is a CLI the engine already runs; Garnet is
  a GitHub Action step + a public PR comment it reads.
- **No self-hosted runners.** Everything here runs on stock `ubuntu-latest`.
- **No maintainer/org permissions** beyond what your own CI already has.
- **One integration point.** [`garnet_runtime.py`](tools/pr-approval-agent/garnet_runtime.py)
  is the dependency-territory analogue of PostHog's own `migration_risk.py`
  check: a clean, head-pinned runtime record lifts the `deps_toolchain` deny;
  off-baseline egress keeps it and names the destination.

```
Migration-risk check   →  migrations/ deny bypass   (PostHog's own pattern)
Garnet runtime record  →  deps_toolchain deny bypass (this demo)
```

The gate reads only the **public** Garnet comment (markers `<!-- garnet-runtime-review -->`
and `<!-- garnet:commit <sha> -->`). Nothing in the integration touches Garnet
internals — any consumer of PR comments could do the same.

---

## The safety rails (all proven, not asserted)

- **Scoped bypass.** Garnet only lifts the deny on dependency-shaped files. Auth,
  billing, and migration files can never ride along — see the express demo PR
  ([#__EXPRESS_PR__](https://github.com/garnet-labs/garnet-runtime-review-demo/pull/__EXPRESS_PR__)).
- **Head-pinned.** Assurance is bound to the exact commit SHA. A record on an
  older commit confers nothing.
- **Fail-safe.** Missing / stale / still-recording evidence → **WAIT**, never a
  silent approve. The gate never races the sensor.
- **Legend-safe.** The record's illustrative legend is never mistaken for
  recorded data (a real bug we found and fixed; now covered by the proof suite).

---

## See it live

1. **Read the two PRs above.** Each carries the Garnet Runtime Review comment
   (the recorded truth) and the gate's verdict comment.
2. **Click the run links** to see the gate's reasoning in the CI log.
3. **Reproduce it yourself** in a few minutes — [`VERIFY.md`](VERIFY.md).
4. **Watch it stay true** — the [Living Proof](https://github.com/garnet-labs/garnet-runtime-review-demo/actions/workflows/proof-check.yml)
   workflow re-asserts the whole A/B on every push and weekly. Green badge = the
   proof still holds.

---

## Deeper reading

- [`PROOF.md`](PROOF.md) — the full A/B with every live run and PR linked.
- [`docs/integration-guide.md`](docs/integration-guide.md) — how to wire your own
  review harness to Garnet (the general model behind this demo).
- [`REVIEW.md`](REVIEW.md) — the reviewer-grounding contract every AI reviewer in
  this repo follows.
- [`NOTICE.md`](NOTICE.md) — attribution for the vendored PostHog engine.

---

*This is a demonstration by [Garnet](https://garnet.ai). The review engine is
PostHog's open-source work, used verbatim and with gratitude to show Garnet
integrating with a real gate rather than a toy.*
