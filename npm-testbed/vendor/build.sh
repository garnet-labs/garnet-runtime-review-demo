#!/usr/bin/env bash
# Reproducibly builds chart-helpers-1.0.0.tgz from src/, bundling the transitive
# chain chart-helpers -> date-fmt -> metrics-beacon so that installing the single
# top-level tarball also installs (and runs the postinstall of) the deep dep.
# This is a BENIGN demo fixture; see src/metrics-beacon/beacon.js.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
work="$(mktemp -d)"
cp -r "$here/src/chart-helpers" "$work/chart-helpers"
mkdir -p "$work/chart-helpers/node_modules/date-fmt"
cp -r "$here/src/date-fmt/." "$work/chart-helpers/node_modules/date-fmt/"
mkdir -p "$work/chart-helpers/node_modules/date-fmt/node_modules/metrics-beacon"
cp -r "$here/src/metrics-beacon/." "$work/chart-helpers/node_modules/date-fmt/node_modules/metrics-beacon/"
( cd "$work/chart-helpers" && npm pack --pack-destination "$here" >/dev/null )
rm -rf "$work"
echo "built $here/chart-helpers-1.0.0.tgz"
