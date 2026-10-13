# Churn spike — throwaway

**Status: throwaway. This is not product code. Nothing here goes into `src/`.**

Purpose: de-risk plan task **T8** (git backfill) as cheaply as possible, and produce the
artifact that plan task **T1/E2** needs for discovery interviews — real numbers from real
repositories instead of a mock.

```bash
node scratch/churn-spike/analyze.mjs                      # axios + express (defaults)
node scratch/churn-spike/analyze.mjs <git-url> [...]      # any public repo
```

Repos are cloned to `scratch/churn-spike/.repos/` (gitignored) and results written to
`scratch/churn-spike/out/*.json`.

---

## Metric definition (v0, deterministic)

> A line is **churned** if it was added at time `T` and deleted — or replaced by a
> different line — at the same path within **21 days**.

- *Self-churn* = the deleting commit has the same author as the adding commit.
- *Other-churn* = a different author.

Added/deleted lines are matched **LIFO within a (path, normalised-content) stack**, so a
line is matched against the most recent identical addition. Normalisation = trim trailing
whitespace; blank lines are skipped entirely.

Deliberately out of scope for a spike (all documented under *Known false positives*):

rename-agnostic line identity across large rewrites, comment/blank-line policy beyond
skipping blanks, binary files, merge commits (`--no-merges`), and cross-file moves.

---

## Results

Measured 2026-10-13, default branch, full history, single Node process, no database.

| | axios | express |
|---|---|---|
| URL | `axios/axios` | `expressjs/express` |
| History | 2 223 commits, 2014-08-18 → 2026-10-12 | 6 181 commits, 2009-06-26 → 2026-10-09 |
| Clone | 2.7 s | 1.8 s |
| **Parse** | **4.3 s** (313 k added lines → ~73 k lines/s) | **1.0 s** (113 k added lines → ~113 k lines/s) |
| Files touched | 771 | 872 |
| Lines added / deleted | 312 908 / 227 003 | 113 459 / 90 999 |
| **Churned ≤21d** | **90 947 → 29.07 %** | **32 837 → 28.94 %** |
| self / other / bot-added | 83 928 / 7 019 / 5 310 | 31 163 / 1 674 / 14 |
| Bot commits | 11.5 % | 1.0 % |
| Renames handled | 49 | 162 |
| **Churn inside generated files** | **87.3 %** | **42.2 %** |

Full machine-readable output: `out/axios.json`, `out/express.json`, `out/index.json`.

### Top source files, generated files excluded

**axios** (raw top-10 was 9/10 lockfiles and `dist/` bundles):

```
 churn   rate   added  path
  1090   100%    1090  axios.js                      ← file-deletion artifact, see below
   797   16.2%   4927  test/unit/adapters/http.js
   654    16%    4088  README.md
   569    18%    3163  lib/adapters/http.js
   400    5.8%   6921  tests/unit/adapters/http.test.js
   302   13.4%   2257  tests/unit/adapters/fetch.test.js
   302   25.7%   1177  package.json
   280   42.5%    659  lib/axios.js
   273   14.1%   1942  lib/utils.js
   272   12.7%   2148  index.d.ts
```

**express** (raw top-1 was `docs/api.html` at 77.3 %):

```
 churn   rate   added  path
  2179   65.7%   3316  lib/express/core.js
  1784   56.7%   3149  test/response.test.js
   732   56.9%   1287  lib/express/view.js
   614    38.6%   1591  package.json
   513   17.7%   2897  lib/response.js
   447   22.7%   1968  test/view.test.js
   409   20.9%   1953  lib/router/index.js
   402     58%     693  spec/spec.core.js
   383    40.4%    949  lib/express/mime.js
   370    8.7%    4265  History.md
```

---

## Manual verification (the number is worthless if this fails)

Two events were checked by hand against `git show`.

**1. `is-plain-obj` — a plain add→delete pair.** The parser reported `module.exports = candidate => {`,
the following `if (...)` and `const prototype = ...` as churned, added in `1ee301e`, deleted
in `9748067`, other-churn (different author).

```bash
git show 1ee301e -- index.js | grep -n "^+"   # → all three lines present as additions
git show 9748067 -- index.js | grep -n "^-"   # → all three lines present as deletions
```

**2. `express` — churn across a rename.** The parser reported the same three lines added at
`lib/express.core.js` in `e6f71f9` and deleted at `lib/express/core.js` in `dca7e9b`
(the "Re-organizing lib directory" commit that renamed the file in the same change).

```bash
git show dca7e9b --unified=0 -M | awk '/rename to lib\/express\/core\.js/{f=1} f&&/^diff --git/{if(++n>1)exit} f'
```

→ `@@ -679,7 +678,0 @@ use = Express.addModule` followed by exactly the three removed lines.

**Verification trap worth remembering:** `git show <sha> -- <path>` silently disables rename
detection, so it renders the same change as "new file, 678 lines added" and the deletion
appears to vanish. Always verify renames against the unfiltered diff.

---

## What this tells us about the plan

1. **T8 is not the scary part.** A 6 181-commit / 17-year history parses in **1 second** with
   plain `git log --patch` and a streaming line parser. The plan's 15-minute import SLA for a
   50k-commit repo looks comfortable. The open question is not *throughput*, it is the
   ≥300k-commit monorepo and LFS cases, which this spike did **not** cover and which T8's exit
   criteria still require.
2. **~29 % churn on both repos is a suspiciously stable number.** Two unrelated projects, two
   different eras, same answer. Either it is a real property of mature JS projects, or — more
   likely — our definition is capturing something coarser than "rework". **This must be
   interrogated before it becomes a headline metric**, not after.
3. **The generated-file filter is a P0 product requirement, not a cleanup task.** 87 % of
   axios's churn lives in lockfiles and `dist/` bundles. Ship the unfiltered list and the
   product's first impression is "your hotspot is `package-lock.json`" — which is exactly the
   vanity-dashboard failure mode the plan warns about (Part XI, anti-vanity list). The filter
   belongs in the metric catalog, versioned and per-repo tunable, from day one.
4. **Self-churn dominates (92 % axios, 95 % express).** People rewrite their own recent code far
   more than they rewrite each other's. That is a *different* story from the "someone else keeps
   breaking my file" narrative, and it is the more useful one for an AI-era product — it smells
   like iteration, not conflict. Worth a question in the discovery interviews.
5. **Bot churn is measurable right now, with zero vendor APIs.** 5 310 churned lines in axios came
   from bot-authored additions, and 11.5 % of its commits are bots. This is the cheapest possible
   evidence that the "human vs agent" attribution axis (plan Part XIV) is tractable from git alone —
   no Copilot API integration needed for tier-0.

---

## Known false positives — read before quoting any number

- **File deletion looks like 100 % churn.** `axios.js` shows 1090/1090 churned purely because the
  file was deleted in `d0bdde4c` ("remove browserified file"). Every surviving line matched an
  earlier addition. A real metric must separate *deleted file* from *reworked line*.
- **Rename churn is attributed to the new path** (sample 2 above is correct behaviour, but the
  `addedSha` refers to a commit where the file lived at the old path). Any UI showing evidence
  must resolve the path per-commit, or the cited commit will look wrong to the user.
- **Reformatting and lint passes register as churn.** A whole-file reindent deletes and re-adds
  every line; with our normalisation those pairs match as identical content only if the text is
  unchanged, so indentation-only changes are partially absorbed — but not reliably.
- **Merges are excluded** (`--no-merges`), so churn introduced and resolved entirely inside a
  merge is invisible.
- **Binary files are skipped** (11 diffs in axios, 54 in express); asset churn is unmeasured.
- **Comment and blank-line policy is one rule for all languages**, which over- or under-counts
  depending on the ecosystem.

---

## Suggested next step

Do **not** turn this into the real pipeline yet. The cheapest high-value follow-up is a half-day:

1. Re-run on the five T8 repos (incl. one ≥300k-commit monorepo and one LFS repo) to get the real
   throughput and memory numbers the plan's exit criteria demand.
2. Fix the *deleted-file* false positive and re-measure — the 29 % figure will move, and knowing
   by how much is the whole point.
3. Take the before/after top-10 lists into the discovery interviews as the E2 artifact.

Everything else — schema, GitHub App, `/v1` conventions, UI — stays blocked behind that.
