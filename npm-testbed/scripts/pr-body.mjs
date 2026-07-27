// Prints the batch PR body. Env: PKG_NAME, PKG_VERSION, BATCH.
const { PKG_NAME: name, PKG_VERSION: version, BATCH: batch } = process.env
console.log(`## npm top-10 testbed — batch ${batch}

Adds a single dependency to \`npm-testbed/app/package.json\`:

| Package | Version | Batch |
| --- | --- | --- |
| [\`${name}\`](https://www.npmjs.com/package/${name}) | \`${version}\` | ${batch} of 10 |

The diff is deliberately minimal — a couple of lines in one manifest. What
actually happens when CI installs and first-imports this package (transitive
dependency tree, spawned processes, outbound network egress, install scripts)
is recorded by the Garnet sensor and posted to this PR:

- **Garnet Runtime Review** comment — the factual runtime record (process
  lineage + outbound destinations) for this PR head.
- **Static review surface vs execution surface** comment — the coverage-gap
  table contrasting the lines a diff reviewer sees with the execution
  surface the run actually touched.

Reviewers: see [\`REVIEW.md\`](/${process.env.GITHUB_REPOSITORY}/blob/main/REVIEW.md)
— cross-check the recorded runtime behavior against what this one-line
dependency change implies, and flag anything the diff does not explain.`)
