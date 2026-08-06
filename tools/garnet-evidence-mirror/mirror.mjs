// Garnet evidence mirror — upsert the head-bound Garnet Runtime Review
// comment into the PR description between stable markers.
//
// Why: some AI reviewers (verified empirically with Greptile) never receive
// PR discussion comments in their review context, so the sticky comment —
// however well marked — cannot ground them. Every mainstream reviewer does
// read the PR description. Mirroring the comment verbatim into a marked
// description section gives those reviewers the same bytes, with the same
// head binding, at zero configuration for the repo owner.
//
// Contract:
//   - The mirrored record is byte-identical to the sticky comment (verbatim
//     mirror). Nothing is summarized, reordered, or subtracted.
//   - The section is bounded by `<!-- garnet:evidence:begin -->` /
//     `<!-- garnet:evidence:end -->`, each alone on its own line; everything
//     outside it is untouched. Marker text mentioned inside prose or code
//     spans (as this PR's own description does) is never treated as a
//     delimiter.
//   - Only a comment whose `<!-- garnet:commit <sha> -->` equals the PR's
//     current head is mirrored. No head-bound comment → the section states
//     that no runtime evidence exists for the head (never silently stale).
//   - When the mirror would push the description past GitHub's size limit,
//     the section carries the head binding and a pointer to the sticky
//     comment instead of the record, and says so explicitly.
//
// Environment: GITHUB_TOKEN, GITHUB_REPOSITORY, PR_NUMBER; optional
// HEAD_SHA (resolved from the PR when unset — workflow_dispatch has no
// pull_request payload) and GITHUB_API_URL.
//
// The installed App posts the sticky comment asynchronously after the
// sensor's profiles arrive, so the mirror polls for a head-bound comment
// before concluding the evidence is missing.

const RUNTIME_REVIEW_MARKER = "<!-- garnet-runtime-review -->"
const BEGIN = "<!-- garnet:evidence:begin -->"
const END = "<!-- garnet:evidence:end -->"
// Delimiters count only when the marker is the entire line — prose that
// mentions the marker text must not be spliced.
const BEGIN_LINE_RE = /^<!-- garnet:evidence:begin -->[ \t]*\r?$/m
const END_LINE_RE = /^<!-- garnet:evidence:end -->[ \t]*\r?$/m
const COMMIT_RE = /<!--\s*garnet:commit\s+([0-9a-f]{40})\s*-->/

// GitHub caps issue/PR bodies at 65536 characters; leave headroom for the
// rest of the description.
const BODY_LIMIT = 65536
const TRUSTED_AUTHORS = new Set([
  "github-actions[bot]",
  "garnet-runtime-review[bot]",
  "garnet-runtime-review-dev[bot]",
])

// The App comment usually lands within a minute of the record completing.
const POLL_ATTEMPTS = 10
const POLL_INTERVAL_MS = 30_000

const api = process.env.GITHUB_API_URL || "https://api.github.com"
const repo = process.env.GITHUB_REPOSITORY
const prNumber = process.env.PR_NUMBER
let headSha = process.env.HEAD_SHA || ""

async function github(path, init = {}) {
  const res = await fetch(`${api}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers || {}),
    },
  })
  if (!res.ok) throw new Error(`${init.method || "GET"} ${path}: ${res.status} ${await res.text()}`)
  return res.json()
}

async function listComments() {
  const all = []
  for (let page = 1; page <= 10; page += 1) {
    const batch = await github(`/repos/${repo}/issues/${prNumber}/comments?per_page=100&page=${page}`)
    all.push(...batch)
    if (batch.length < 100) break
  }
  return all
}

/** The head-bound Garnet comment to mirror. Only comments carrying the
 *  production ownership + commit markers qualify — the testbed's
 *  reference-renderer mockup deliberately rewrites both markers and a mirror
 *  of it would carry no `garnet:commit` binding for reviewers to verify. The
 *  installed App's live comment is preferred over the Action fallback. */
function selectEvidenceComment(comments) {
  const bound = comments.filter((c) => {
    if (!TRUSTED_AUTHORS.has(c.user?.login)) return false
    if (!c.body?.includes(RUNTIME_REVIEW_MARKER)) return false
    const m = COMMIT_RE.exec(c.body)
    return m !== null && m[1] === headSha
  })
  return bound.find((c) => c.body.includes(":v1:app.garnet.ai")) ?? bound[0] ?? null
}

function section(inner) {
  return [BEGIN, "## Runtime evidence (Garnet)", "", inner.trim(), END].join("\n")
}

function evidenceSection(comment, remainingBudget) {
  const sha7 = headSha.slice(0, 7)
  const preamble = [
    `Kernel-recorded execution record for head \`${headSha}\`, mirrored verbatim from`,
    "the sticky Garnet Runtime Review comment on this PR so reviewers that read only",
    "the description ground in the same bytes. Facts only — process chains and the",
    "destinations each chain reached; judgment stays with the reviewer (see",
    `[REVIEW.md](${process.env.GITHUB_SERVER_URL || "https://github.com"}/${repo}/blob/HEAD/REVIEW.md)). Cite grounded findings as:`,
    "",
    `> Runtime evidence (Garnet, head \`${sha7}\`): \`<process lineage>\` → \`<destination>\` (\`<workflow>/<job>\`) — <Execution Profile URL>`,
    "",
  ].join("\n")
  const mirrored = ["<details><summary>Execution record (verbatim mirror)</summary>", "", comment.body.trim(), "", "</details>"].join("\n")
  const full = section(`${preamble}\n${mirrored}`)
  if (full.length <= remainingBudget) return full
  return section(
    `<!-- garnet:commit ${headSha} -->\n${preamble}\nThe record for head \`${sha7}\` exceeds the description size budget and is not` +
      ` mirrored here — read it verbatim in [the sticky Garnet Runtime Review comment](${comment.html_url}).`,
  )
}

function missingSection() {
  return section(
    `No runtime evidence is bound to head \`${headSha.slice(0, 7)}\` yet — the sticky Garnet` +
      " Runtime Review comment either has not been posted for this head or describes an earlier" +
      " commit. Missing evidence means *no record*, not a clean run.",
  )
}

function upsert(body, block) {
  const begin = BEGIN_LINE_RE.exec(body)
  if (begin) {
    const after = body.slice(begin.index)
    const end = END_LINE_RE.exec(after)
    if (end) {
      return body.slice(0, begin.index) + block + after.slice(end.index + end[0].length)
    }
  }
  return `${body.trimEnd()}\n\n${block}\n`
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function main() {
  if (!process.env.GITHUB_TOKEN || !repo || !prNumber) {
    throw new Error("GITHUB_TOKEN, GITHUB_REPOSITORY and PR_NUMBER are required")
  }
  let pr = await github(`/repos/${repo}/pulls/${prNumber}`)
  if (!headSha) headSha = pr.head?.sha ?? ""
  if (!headSha || pr.head?.sha !== headSha) {
    console.log(`PR head moved (${pr.head?.sha?.slice(0, 7)} != ${headSha.slice(0, 7)}); not mirroring a stale record.`)
    return
  }
  let comment = null
  for (let attempt = 1; attempt <= POLL_ATTEMPTS; attempt += 1) {
    comment = selectEvidenceComment(await listComments())
    if (comment) break
    if (attempt < POLL_ATTEMPTS) {
      console.log(`No head-bound record yet (attempt ${attempt}/${POLL_ATTEMPTS}); waiting.`)
      await sleep(POLL_INTERVAL_MS)
    }
  }
  pr = await github(`/repos/${repo}/pulls/${prNumber}`)
  if (pr.head?.sha !== headSha) {
    console.log("PR head moved while waiting; not mirroring a stale record.")
    return
  }
  const currentBody = pr.body ?? ""
  const bodyWithoutSection = upsert(currentBody, "\u0000").replace("\u0000", "")
  const block = comment
    ? evidenceSection(comment, BODY_LIMIT - bodyWithoutSection.length)
    : missingSection()
  const nextBody = upsert(currentBody, block)
  if (nextBody === currentBody) {
    console.log("Evidence section already current; nothing to do.")
    return
  }
  await github(`/repos/${repo}/pulls/${prNumber}`, {
    method: "PATCH",
    body: JSON.stringify({ body: nextBody }),
  })
  console.log(
    comment
      ? `Mirrored head-bound record (comment ${comment.id}) into the PR description.`
      : "No head-bound record found; description section states evidence is missing.",
  )
}

await main()
