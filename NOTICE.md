# Attribution

This repository demonstrates adding **Garnet** runtime evidence to a **real**,
unmodified PR-review merge gate. To keep the demo honest, the gate is not a
mock — it is PostHog's own open-source review engine, vendored verbatim.

## Vendored from PostHog (MIT License)

The following paths are copied, unmodified except where noted, from
[PostHog](https://github.com/PostHog/posthog)'s open-source `pr-approval-agent`
("stamphog") and are © PostHog, licensed under the MIT License:

- `tools/pr-approval-agent/` — the review engine (gates, policy, reviewer)
- `tools/owners/` — the `posthog_owners` ownership resolver the engine consumes
- `.stamphog/` — the declarative policy (`policy.yml`, `review-guidance.md`)

PostHog is not affiliated with this demo and does not endorse it. Their engine
is used here as a faithful, runnable stand-in for the class of "assurance-
aggregating" merge gates so evaluators can see Garnet integrate with a real gate
rather than a toy. See the upstream project for the canonical source and license.

## Original to this repository (MIT License)

Everything else — the Garnet runtime-assurance consumer
(`tools/pr-approval-agent/garnet_runtime.py`), the recording and review
workflows under `.github/workflows/`, the `npm-testbed/` workload, the living-
proof suite, and all documentation — is original to this demo and licensed under
the MIT License in `LICENSE`.

The single line of integration into the vendored engine is
`garnet_runtime.py`'s consumption by the gate: it is the dependency-territory
analogue of PostHog's own `migration_risk.py` check, and it reads only the
**public** Garnet Runtime Review PR comment — nothing about Garnet's internals.
