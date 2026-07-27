// Smoke runner: imports every dependency declared in package.json and, where
// a known exercise exists, calls a representative export. Anything the
// packages do at install or first-import time (postinstall scripts, file
// writes, network egress) is recorded by the Garnet sensor running on the CI
// runner — this script only proves the package loads and its API answers.
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)

const exercises = {
  semver: (m) => m.satisfies("1.2.3", "^1.0.0"),
  debug: (m) => m("testbed")("hello"),
  "ansi-styles": (m) => m.red.open + "x" + m.red.close,
  ms: (m) => m("2 days"),
  chalk: (m) => m.green("ok"),
  "supports-color": (m) => m.createSupportsColor?.(1) ?? m.stdout,
  commander: (m) => new m.Command().name("smoke"),
  tslib: (m) => m.__assign({}, { a: 1 }),
  uuid: (m) => m.v4(),
  lodash: (m) => m.chunk([1, 2, 3, 4], 2),
}

const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"))
const deps = Object.keys(pkg.dependencies ?? {}).sort()
if (deps.length === 0) {
  console.log("smoke: no dependencies declared — nothing to exercise")
  process.exit(0)
}

let failed = 0
for (const name of deps) {
  try {
    let mod
    try {
      mod = await import(name)
    } catch {
      mod = require(name)
    }
    const api = mod?.default ?? mod
    const result = exercises[name] ? exercises[name](api) : "imported (no exercise registered)"
    console.log(`smoke: ${name} OK ->`, typeof result === "string" ? result.slice(0, 80) : result)
  } catch (err) {
    failed += 1
    console.error(`smoke: ${name} FAILED -> ${err.message}`)
  }
}
process.exit(failed === 0 ? 0 : 1)
