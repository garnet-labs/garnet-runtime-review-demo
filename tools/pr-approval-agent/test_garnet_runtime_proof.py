"""Self-verifying proof of the Garnet runtime-assurance decision rule.

This is the "living proof" the demo advertises: it constructs synthetic Garnet
Runtime Review comments in each state (clean / loud / stale / pending / legend-
only) and asserts that the gate makes the intuitively correct call. It runs in
milliseconds with no network and no LLM key, so the `.github/workflows/
proof-check.yml` schedule keeps a green badge only while the core A/B still
holds.

The four claims under test are exactly the ones an evaluator cares about:

  1. clean, head-pinned record        -> deps deny is LIFTED (bypass granted)
  2. off-baseline egress (httpbin)     -> deps deny STANDS + destination named
  3. stale / pending record            -> WAIT (never a silent approve)
  4. the comment's legend example      -> NEVER parsed as recorded egress
  5. scoping: only dependency-shaped files can ride the bypass, never auth
"""

from __future__ import annotations

from garnet_runtime import (
    _parse_comment,
    garnet_record_pending,
    runtime_assured_files,
)

HEAD = "a" * 40
STALE = "b" * 40

_LEGEND = (
    "<details><summary>\U0001f4a1 Reading this review</summary>\n"
    "<pre>\n"
    "<strong>bash</strong>\n"
    "  \u2192 example.com\n"
    "</pre>\n"
    "</details>\n"
)


def _comment(commit: str, workload_dests: list[str], *, pending: bool = False) -> str:
    """Build a synthetic sticky Garnet Runtime Review comment body."""
    marker = "<!-- garnet-runtime-review -->"
    commit_marker = f"<!-- garnet:commit {commit} -->"
    pend = "\ngarnet-control-plane-pending-pr-comment\n" if pending else ""
    tree_lines = ["<strong>npm install</strong>"]
    for d in workload_dests:
        tree_lines.append(f"  \u2192 {d}")
    # a scaffold (runner infra) line that must never count against the workload
    tree_lines += ["<em>Runner.Worker</em>", "  \u2192 api.github.com"]
    tree = "\n".join(tree_lines)
    job = (
        "<details><summary>Record: install under Garnet \u00b7 "
        '<a href="/garnet-labs/garnet-runtime-review-demo/actions/runs/123">run</a>'
        "</summary>\n<pre>\n" + tree + "\n</pre>\n</details>\n"
    )
    return f"{marker}\n{commit_marker}{pend}\n{_LEGEND}\n{job}"


DEP_FILES = ["npm-testbed/app/package.json", "npm-testbed/app/package-lock.json"]


def test_clean_record_lifts_the_deps_deny():
    rec = _parse_comment(_comment(HEAD, ["registry.npmjs.org"]))
    assert rec.pinned_to(HEAD)
    assert rec.off_baseline() == set(), "registry-only egress is baseline-clean"
    assured = runtime_assured_files(rec, HEAD, DEP_FILES)
    assert set(assured) == set(DEP_FILES), "clean record lifts the deps deny"
    assert not garnet_record_pending(rec, HEAD, DEP_FILES)


def test_off_baseline_egress_keeps_the_deny_and_names_the_destination():
    rec = _parse_comment(_comment(HEAD, ["registry.npmjs.org", "httpbin.org"]))
    assert rec.pinned_to(HEAD)
    assert rec.off_baseline() == {"httpbin.org"}, "httpbin is off-baseline"
    assert runtime_assured_files(rec, HEAD, DEP_FILES) == set(), "deny stands"


def test_stale_record_waits():
    rec = _parse_comment(_comment(STALE, ["registry.npmjs.org"]))
    assert not rec.pinned_to(HEAD)
    assert runtime_assured_files(rec, HEAD, DEP_FILES) == set()
    assert garnet_record_pending(rec, HEAD, DEP_FILES), "stale head -> WAIT"


def test_pending_record_waits():
    rec = _parse_comment(_comment(HEAD, ["registry.npmjs.org"], pending=True))
    assert rec.pending
    assert runtime_assured_files(rec, HEAD, DEP_FILES) == set()
    assert garnet_record_pending(rec, HEAD, DEP_FILES), "pending -> WAIT"


def test_missing_record_waits():
    assert runtime_assured_files(None, HEAD, DEP_FILES) == set()
    assert garnet_record_pending(None, HEAD, DEP_FILES), "no record -> WAIT"


def test_legend_example_is_never_parsed_as_egress():
    rec = _parse_comment(_comment(HEAD, ["registry.npmjs.org"]))
    assert "example.com" not in rec.workload_destinations
    assert "example.com" not in rec.off_baseline()


def test_scaffold_egress_is_not_counted_against_the_workload():
    rec = _parse_comment(_comment(HEAD, ["registry.npmjs.org"]))
    # api.github.com was recorded under runner scaffolding -> excluded
    assert rec.off_baseline() == set()


def test_bypass_is_scoped_to_dependency_files_only():
    files = DEP_FILES + ["posthog/api/authentication.py", "billing/stripe.py"]
    rec = _parse_comment(_comment(HEAD, ["registry.npmjs.org"]))
    assured = runtime_assured_files(rec, HEAD, files)
    assert set(assured) == set(DEP_FILES), "auth/billing never ride the bypass"
