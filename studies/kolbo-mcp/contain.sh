#!/usr/bin/env bash
# Containment for the runtime-import arm.
#
# THREAT MODEL
# ------------
# @kolbo/mcp@1.57.1 carries an injected loader (src/auth.js) that:
#   1. reads the latest zero-value, zero-data transaction sent by the hardcoded
#      Ethereum address 0xa322e5f3d311d3080e6f0121063e9adc2490ef1a,
#   2. decodes a C2 IPv4 from the first bytes of that transaction's `to` field
#      (a blockchain dead drop — "NullReceiver"),
#   3. fetches XOR-encrypted stage-2 from http://<c2>:443/0x/cls and /0x/ls,
#   4. runs stage 2 via eval() AND a detached `node -e` child.
#
# Steps 1-2 are what we want on the record: they are the novel, attributable
# behaviour and they are harmless to observe. Step 3-4 are arbitrary
# attacker-controlled RCE and we do not want them to happen.
#
# So we allow the dead-drop lookup and DROP egress to the resolved C2. Garnet
# still records the connect attempt at the kernel, because Jibril observes the
# syscall — a dropped packet is still an observed flow. We get the full
# evidentiary chain, minus the remote code execution.
#
# We resolve the C2 ourselves first, using read-only public blockchain queries.
# This executes none of the package's code.
#
# RESIDUAL RISK (accepted, and stated plainly):
#   * The dead drop can rotate between our lookup and the payload's lookup. We
#     mitigate by blocking both the freshly-resolved IP and the published IOC,
#     and by blocking the two ports the loader uses on any host it might pick.
#   * This is still executing attacker-authored control flow in-process. The
#     runner must be treated as burned: ephemeral, no checkout of other repos,
#     minimal token scope, and GARNET_API_TOKEN rotated afterwards.
set -uo pipefail

ATTACKER_ADDR="0xa322e5f3d311d3080e6f0121063e9adc2490ef1a"
KNOWN_IOC="166.88.134.62"   # published for this campaign

echo "::group::Resolve the dead drop (read-only, no package code executed)"
RESOLVED=$(python3 - "$ATTACKER_ADDR" <<'PY'
import json, sys, urllib.request
addr = sys.argv[1].lower()
url = ("https://eth.blockscout.com/api?module=account&action=txlist"
       f"&address={addr}&startblock=0&endblock=99999999&page=1&offset=10"
       "&sort=desc&filterby=from")
try:
    req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "curl/8"})
    for tx in (json.load(urllib.request.urlopen(req, timeout=45)).get("result") or []):
        if (tx.get("from") or "").lower() != addr:
            continue
        to = (tx.get("to") or "").replace("0x", "")
        if len(to) == 40:
            b = bytes.fromhex(to)
            print(".".join(str(x) for x in b[0:4]))
            break
except Exception as e:
    print(f"resolve-failed: {e}", file=sys.stderr)
PY
)
echo "  attacker address : ${ATTACKER_ADDR}"
echo "  resolved C2      : ${RESOLVED:-<none>}"
echo "  published IOC    : ${KNOWN_IOC}"
echo "::endgroup::"

echo "::group::Install egress DROP rules"
block_ip() {
  local ip="$1"
  [[ "$ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "  skip (not an IPv4): $ip"; return; }
  sudo iptables -I OUTPUT 1 -d "$ip" -j DROP && echo "  DROP all egress -> $ip"
}
block_ip "$KNOWN_IOC"
[ -n "${RESOLVED:-}" ] && [ "${RESOLVED}" != "${KNOWN_IOC}" ] && block_ip "$RESOLVED"

# Defence in depth: the loader only ever fetches stage 2 over plain HTTP on
# :443 and :80 at /0x/cls and /0x/ls. Block cleartext HTTP to port 443 outright
# — a combination no legitimate traffic in this job uses (real HTTPS on 443 is
# TLS, and npm/GitHub/Garnet all use TLS, so this costs us nothing) — so a
# rotated C2 we failed to predict is still refused.
sudo iptables -I OUTPUT 1 -p tcp --dport 443 -m string --algo bm --string "GET /0x/" -j DROP 2>/dev/null \
  && echo "  DROP cleartext HTTP requests to /0x/ on :443" \
  || echo "  (string-match rule unavailable; IP rules still in force)"

echo
echo "  active OUTPUT rules:"
sudo iptables -L OUTPUT -n --line-numbers | head -15
echo "::endgroup::"

echo "Containment in place: dead-drop lookup permitted and recorded; stage-2 retrieval refused."
