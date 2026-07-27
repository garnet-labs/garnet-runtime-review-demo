# Vendored demo dependency: `chart-helpers`

This directory is **repo infrastructure**, committed to `main` on its own. It is
the local stand-in for "a package on the registry." It exists so a demo PR can
add a single, innocent-looking dependency reference whose **transitive** behaviour
is invisible in that PR's diff — the whole point of the runtime-evidence demo.

## What's here

- `chart-helpers-1.0.0.tgz` — the installable artifact the app depends on.
- `src/` — the readable sources, for transparency (so evaluators can confirm this
  is a **benign** fixture, not real malware).
- `build.sh` — reproducibly rebuilds the tarball from `src/`.

## The dependency chain

```
app  ──▶ chart-helpers  ──▶ date-fmt  ──▶ metrics-beacon
        (charting util)    (date helper)   (install-time recon + beacon)
```

`chart-helpers` bundles `date-fmt`, which bundles `metrics-beacon`. Installing the
single top-level tarball therefore also installs — and runs the `postinstall` of —
the **two-levels-deep** `metrics-beacon`.

## What `metrics-beacon` does at install time

See [`src/metrics-beacon/beacon.js`](src/metrics-beacon/beacon.js). At **install
time** it performs host/network reconnaissance and beacons out to three
off-registry hosts:

| Host | Role |
|---|---|
| `api.ipify.org` | reads the runner's public IP (recon) |
| `ip-api.com` | geolocates that IP (recon) |
| `httpbin.org` | beacon / exfil sink |

All three are real, reachable, and harmless — the calls send nothing sensitive.
They model the *class* of behaviour seen in real supply-chain incidents
(typosquats and compromised transitive deps that phone home from a lifecycle
script).

## Why this is the honest test

A PR that adds `chart-helpers` shows a **two-line diff** (manifest + lockfile).
None of the egress above appears in that diff — it lives two dependencies deep,
inside an opaque artifact. A diff-only reviewer, and most static checks, pass it.
Garnet records the install under a kernel (eBPF) sensor and surfaces the egress,
so the gate can refuse and **name the hosts**. That contrast is the demo.

To rebuild: `./build.sh`.
