#!/usr/bin/env python3
"""Render the Garnet runtime-grounding of a stamphog verdict as markdown.

Reads a verdict JSON produced by `review_pr.py --output-json` and prints a
short "Runtime evidence (Garnet)" section that makes the deterministic result
self-explanatory: it states whether a head-pinned record was consulted, what
workload egress it recorded, and whether that lifted or withheld the
`deps_toolchain` deny. This is what lets the public demo *show* the runtime
grounding on the Garnet token alone, without an LLM key.

Usage: python render_grounding.py verdict-<PR>.json
"""
from __future__ import annotations

import json
import sys


def render(verdict: dict) -> str:
    c = verdict.get("classification", verdict)
    gr = c.get("garnet_runtime")
    deny = c.get("deny_categories", [])
    assured = c.get("runtime_assured_files", [])
    lines = ["#### Runtime evidence (Garnet)", ""]

    if not gr:
        touches_deps = any(
            p.endswith(("package.json", "package-lock.json"))
            for p in c.get("file_paths", [])
        )
        if touches_deps:
            lines.append(
                "- No head-pinned Garnet record consulted → **WAIT** "
                "(the deny is not lifted without runtime evidence)."
            )
        else:
            lines.append("- No dependency files in this PR; runtime record not applicable.")
        return "\n".join(lines)

    commit = (gr.get("commit") or "")[:7]
    pinned = gr.get("pinned_to_head")
    pending = gr.get("pending")
    off = gr.get("off_baseline_destinations", [])

    if pending:
        lines.append(f"- Record `{commit}` is still **recording** → WAIT (verdict does not race the sensor).")
        return "\n".join(lines)
    if not pinned:
        lines.append(f"- Record `{commit}` is **stale** (not pinned to head) → no assurance; deny applies.")
        return "\n".join(lines)

    lines.append(f"- Record: **head-pinned** ✓ (`{commit}`), final.")
    if off:
        hosts = ", ".join(f"`{h}`" for h in off)
        lines.append(f"- Workload egress: **off-baseline** ✗ → {hosts}")
        lines.append(
            "- Runtime bypass: **WITHHELD** — the install reached destinations "
            "outside the npm baseline, so the `deps_toolchain` deny stands and the "
            "hosts above are the evidence."
        )
    else:
        lines.append("- Workload egress: **within npm baseline** ✓ (registry + local resolver only).")
        if assured:
            lines.append(
                "- Runtime bypass: **APPLIED** — clean head-pinned record lifts the "
                "`deps_toolchain` deny for the dependency files."
            )
        else:
            lines.append("- Runtime bypass: not applied (no dependency files eligible).")
    if deny:
        lines.append("")
        lines.append(f"_Deny categories after runtime grounding: {', '.join(deny) or 'none'}._")
    else:
        lines.append("")
        lines.append("_Deny categories after runtime grounding: none._")
    return "\n".join(lines)


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: render_grounding.py verdict.json", file=sys.stderr)
        return 2
    try:
        verdict = json.load(open(sys.argv[1]))
    except Exception as exc:  # noqa: BLE001
        print(f"_(runtime grounding unavailable: {exc})_")
        return 0
    print(render(verdict))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
