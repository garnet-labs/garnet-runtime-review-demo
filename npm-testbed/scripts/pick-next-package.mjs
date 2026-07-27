// Prints "<name> <version> <batchNumber>" for the next package from
// npm-testbed/top10.json that has no testbed PR yet (any PR, open or closed,
// whose head branch is npm-testbed/dep-<name>), or nothing when every
// package is done. Honors PACKAGE_OVERRIDE. Requires GH_TOKEN and
// GITHUB_REPOSITORY (both present in Actions).
import { readFile } from "node:fs/promises"

const repo = process.env.GITHUB_REPOSITORY
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN
const api = process.env.GITHUB_API_URL || "https://api.github.com"
const override = (process.env.PACKAGE_OVERRIDE || "").trim()

const { packages } = JSON.parse(await readFile("npm-testbed/top10.json", "utf8"))

async function branchHasPr(name) {
  const [owner] = repo.split("/")
  const res = await fetch(
    `${api}/repos/${repo}/pulls?state=all&head=${owner}:npm-testbed/dep-${encodeURIComponent(name)}&per_page=1`,
    { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } },
  )
  if (!res.ok) throw new Error(`GET pulls for ${name}: ${res.status} ${await res.text()}`)
  return (await res.json()).length > 0
}

if (override) {
  const idx = packages.findIndex((p) => p.name === override)
  if (idx === -1) {
    console.error(`Override "${override}" is not in top10.json`)
    process.exit(1)
  }
  console.log(`${packages[idx].name} ${packages[idx].version} ${idx + 1}`)
  process.exit(0)
}

for (const [idx, pkg] of packages.entries()) {
  if (!(await branchHasPr(pkg.name))) {
    console.log(`${pkg.name} ${pkg.version} ${idx + 1}`)
    process.exit(0)
  }
}
// all done — print nothing
