#!/usr/bin/env node
/**
 * GitLens churn spike — THROWAWAY, not product code.
 *
 * Purpose: answer two questions cheaply, before any architecture is committed to:
 *   1. Can we ingest a full git history and derive line-level facts from it? (plan T8)
 *   2. Does the "churn" metric produce numbers that survive hand-checking?
 *      (plan T1/E2 — the artifact shown in discovery interviews)
 *
 * Definition used here (deliberately narrow, deterministic, reproducible):
 *   A line is CHURNED if it is added at time T and deleted (or replaced) at the
 *   same path within WINDOW_DAYS days. "Self churn" = the deleting commit has the
 *   same author as the adding commit; "other churn" = a different author.
 *
 * Deliberately NOT attempted here: rename-agnostic identity across large edits,
 * comment/blank-line policy beyond skipping blank lines, binary files, merge
 * commits, and cross-file moves. All documented in README.md.
 */

import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPOS_DIR = path.join(HERE, '.repos');
const OUT_DIR = path.join(HERE, 'out');

const WINDOW_DAYS = 21;
const WINDOW_MS = WINDOW_DAYS * 24 * 60 * 60 * 1000;

const DEFAULT_REPOS = [
	{ name: 'axios', url: 'https://github.com/axios/axios.git' },
	{ name: 'express', url: 'https://github.com/expressjs/express.git' },
];

/**
 * Generated / vendored file policy. Without this filter the "hotspots" are just
 * build output — the single most important finding of this spike (see README).
 */
const GENERATED_PATTERN = [
	/(^|\/)(package-lock|yarn|pnpm-lock|composer|Gemfile)\.(json|lock|yaml)$/,
	/(^|\/)(dist|build|out|coverage|vendor|node_modules|\.next|\.nuxt)\//,
	/(^|\/)(docs?|doc)\//,
	/\.min\.(js|css)$/,
	/\.(map|snap)$/,
	/(^|\/)CHANGELOG(\.md)?$/i,
	/\.(png|jpe?g|gif|svg|ico|woff2?|ttf|eot|pdf)$/i,
];
const isGenerated = p => GENERATED_PATTERN.some(re => re.test(p));

const BOT_PATTERN =
	/\[bot\]$|bot@|dependabot|renovate|github-actions|copilot|snyk-bot|imgbot|greenkeeper|allcontributors|semantic-release/i;

const isBot = (name, email) => BOT_PATTERN.test(name ?? '') || BOT_PATTERN.test(email ?? '');

/** Unit separator / start-of-commit markers unlikely to appear in diffs. */
const REC = '\u0001';
const FS = '\u001f';

// ---------------------------------------------------------------------------
// Clone
// ---------------------------------------------------------------------------

async function ensureClone(repo) {
	const dir = path.join(REPOS_DIR, repo.name);
	try {
		await stat(path.join(dir, '.git'));
		console.log(`  · using existing clone: ${dir}`);
		return dir;
	} catch {
		// fall through
	}
	await rm(dir, { recursive: true, force: true });
	await mkdir(dir, { recursive: true });
	await run('git', ['clone', '--quiet', repo.url, dir]);
	return dir;
}

function run(cmd, args, opts = {}) {
	return new Promise((resolve, reject) => {
		const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts });
		let stderr = '';
		child.stderr.on('data', d => {
			stderr += d;
		});
		child.on('error', reject);
		child.on('close', code => {
			if (code === 0) resolve(stderr);
			else reject(new Error(`${cmd} ${args.join(' ')} exited ${code}\n${stderr}`));
		});
	});
}

// ---------------------------------------------------------------------------
// Pending-add stacks: LIFO matching, O(1) expiry from the front.
// ---------------------------------------------------------------------------

class PendingStack {
	constructor() {
		this.items = [];
		this.head = 0;
	}
	push(entry) {
		this.items.push(entry);
	}
	get size() {
		return this.items.length - this.head;
	}
	/** Drop everything at or before `cutoff` (entries are chronological). */
	expire(cutoff) {
		while (this.head < this.items.length && this.items[this.head].ts <= cutoff) this.head++;
		if (this.head > 0 && this.head * 2 > this.items.length) {
			this.items = this.items.slice(this.head);
			this.head = 0;
		}
	}
	pop() {
		if (this.size === 0) return undefined;
		return this.items.pop();
	}
	peek() {
		return this.size === 0 ? undefined : this.items[this.items.length - 1];
	}
}

// ---------------------------------------------------------------------------
// Parse `git log --patch` into per-file add/delete events, streaming.
// ---------------------------------------------------------------------------

async function parseRepo(repoDir) {
	const stats = {
		commits: 0,
		botCommits: 0,
		filesSeen: new Set(),
		linesAdded: 0,
		linesDeleted: 0,
		blankSkipped: 0,
		binaryFiles: 0,
		renames: 0,
	};

	const files = new Map(); // canonical path -> file record
	const pending = new Map(); // canonical path -> Map<content, PendingStack>
	const globalOrder = []; // {path, content, ts} for periodic expiry
	let globalHead = 0;

	const fileRecord = p => {
		let r = files.get(p);
		if (!r) {
			stats.filesSeen.add(p);
			r = {
				path: p,
				added: 0,
				deleted: 0,
				churned: 0,
				selfChurned: 0,
				otherChurned: 0,
				botChurned: 0,
				samples: [],
			};
			files.set(p, r);
		}
		return r;
	};
	const stackFor = (p, content) => {
		let m = pending.get(p);
		if (!m) {
			m = new Map();
			pending.set(p, m);
		}
		let s = m.get(content);
		if (!s) {
			s = new PendingStack();
			m.set(content, s);
		}
		return s;
	};

	const normalize = raw => raw.replace(/\s+$/, '').trim();

	// --- streaming git log -------------------------------------------------
	const child = spawn(
		'git',
		[
			'-C',
			repoDir,
			'log',
			'--no-merges',
			'--reverse',
			'--date-order',
			'-M',
			'--unified=0',
			'--no-ext-diff',
			'--no-textconv',
			`--format=${REC}%H${FS}%aI${FS}%an${FS}%ae`,
			'--patch',
		],
		{ stdio: ['ignore', 'pipe', 'pipe'] },
	);

	const rl = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });

	let commit = null;
	let curPath = null; // canonical path of the file currently being diffed
	let diffPath = null; // raw path from the +++/--- header
	let inHunk = false;
	let isBinary = false;
	let renameFrom = null;
	let stderr = '';
	child.stderr.on('data', d => {
		stderr += d;
	});

	for await (const line of rl) {
		if (line.startsWith(REC)) {
			commit = parseCommitLine(line.slice(1));
			stats.commits++;
			if (isBot(commit.author, commit.email)) stats.botCommits++;
			if (stats.commits % 1000 === 0) expireGlobally(commit.ts);
			inHunk = false;
			curPath = null;
			continue;
		}
		if (!commit) continue;

		if (line.startsWith('diff --git ')) {
			inHunk = false;
			isBinary = false;
			diffPath = null;
			renameFrom = null;
			continue;
		}
		if (line.startsWith('rename from ')) {
			renameFrom = line.slice('rename from '.length);
			continue;
		}
		if (line.startsWith('rename to ')) {
			const to = line.slice('rename to '.length);
			if (renameFrom) applyRename(renameFrom, to);
			renameFrom = null;
			continue;
		}
		if (line.startsWith('Binary files ') || line.startsWith('GIT binary patch')) {
			isBinary = true;
			stats.binaryFiles++;
			if (diffPath) fileRecord(diffPath).binary = true;
			continue;
		}
		if (line.startsWith('--- ')) {
			const p = stripPrefix(line.slice(4));
			if (p && diffPath === null) diffPath = p; // deleted files have +++ /dev/null
			inHunk = false;
			continue;
		}
		if (line.startsWith('+++ ')) {
			const p = stripPrefix(line.slice(4));
			if (p) diffPath = p;
			if (diffPath) curPath = canonicalize(diffPath);
			inHunk = false;
			continue;
		}
		if (line.startsWith('@@')) {
			inHunk = true;
			continue;
		}
		if (!inHunk || isBinary || !curPath) continue;
		if (line.startsWith('\\')) continue; // "\ No newline at end of file"

		const rec = fileRecord(curPath);
		if (line.startsWith('+')) {
			const content = normalize(line.slice(1));
			if (content === '') {
				stats.blankSkipped++;
				continue;
			}
			stats.linesAdded++;
			rec.added++;
			const entry = { ts: commit.ts, sha: commit.sha, author: commit.author, bot: commit.bot };
			stackFor(curPath, content).push(entry);
			globalOrder.push({ path: curPath, content, ts: commit.ts });
		} else if (line.startsWith('-')) {
			const content = normalize(line.slice(1));
			if (content === '') {
				stats.blankSkipped++;
				continue;
			}
			stats.linesDeleted++;
			rec.deleted++;
			matchDeletion(rec, curPath, content, commit);
		}
	}

	await new Promise((resolve, reject) => {
		child.on('error', reject);
		child.on('close', code => {
			if (code === 0) resolve();
			else reject(new Error(`git log exited ${code}\n${stderr}`));
		});
	});

	// ---- helpers bound to this parse -------------------------------------
	function canonicalize(p) {
		return p; // renames are folded via applyRename; keeps spike simple
	}

	function applyRename(from, to) {
		stats.renames++;
		// carry pending additions and accumulated stats to the new path
		const oldRec = files.get(from);
		if (oldRec) {
			const newRec = fileRecord(to);
			newRec.added += oldRec.added;
			newRec.deleted += oldRec.deleted;
			newRec.churned += oldRec.churned;
			newRec.selfChurned += oldRec.selfChurned;
			newRec.otherChurned += oldRec.otherChurned;
			newRec.botChurned += oldRec.botChurned;
			files.delete(from);
		}
		const oldPending = pending.get(from);
		if (oldPending) {
			const target = pending.get(to) ?? new Map();
			for (const [content, stack] of oldPending) {
				if (stack.size === 0) continue;
				const incoming = stack.items.slice(stack.head);
				const existing = target.get(content);
				if (!existing) {
					target.set(content, new PendingStackFrom(incoming));
				} else {
					// old-path entries are strictly older → they belong in front
					existing.items = [...incoming, ...existing.items.slice(existing.head)];
					existing.head = 0;
				}
			}
			pending.set(to, target);
			pending.delete(from);
		}
	}

	function matchDeletion(rec, filePath, content, commit) {
		const stack = pending.get(filePath)?.get(content);
		if (!stack) return;
		// Expire first: anything older than the window can no longer count.
		stack.expire(commit.ts - WINDOW_MS);
		const added = stack.pop();
		if (!added) return;

		const ageDays = (commit.ts - added.ts) / 86_400_000;
		if (ageDays > WINDOW_DAYS) return;

		rec.churned++;
		if (added.author === commit.author) rec.selfChurned++;
		else rec.otherChurned++;
		if (added.bot) rec.botChurned++;

		if (rec.samples.length < 10) {
			rec.samples.push({
				addedSha: added.sha,
				addedAt: new Date(added.ts).toISOString().slice(0, 10),
				addedBy: added.author,
				deletedSha: commit.sha,
				deletedAt: new Date(commit.ts).toISOString().slice(0, 10),
				deletedBy: commit.author,
				ageDays: Number(ageDays.toFixed(1)),
				line: content.slice(0, 120),
			});
		}
	}

	// periodic global expiry, so memory stays bounded on large histories
	function expireGlobally(ts) {
		const cutoff = ts - WINDOW_MS;
		while (globalHead < globalOrder.length && globalOrder[globalHead].ts <= cutoff) {
			const e = globalOrder[globalHead++];
			const stack = pending.get(e.path)?.get(e.content);
			if (stack) stack.expire(e.ts);
		}
	}

	return { stats, files, expireGlobally };
}

function PendingStackFrom(items) {
	const s = new PendingStack();
	s.items = items;
	return s;
}

function parseCommitLine(raw) {
	const [sha, iso, author, email] = raw.split(FS);
	const ts = Date.parse(iso);
	return { sha, iso, ts, author, email, bot: isBot(author, email) };
}

function stripPrefix(p) {
	if (p === '/dev/null') return null;
	return p.startsWith('a/') || p.startsWith('b/') ? p.slice(2) : p;
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function summarize(stats, files) {
	let churned = 0;
	let self = 0;
	let other = 0;
	let botChurn = 0;
	for (const f of files.values()) {
		churned += f.churned;
		self += f.selfChurned;
		other += f.otherChurned;
		botChurn += f.botChurned;
	}
	return {
		commits: stats.commits,
		botCommits: stats.botCommits,
		filesTouched: stats.filesSeen.size || files.size,
		linesAdded: stats.linesAdded,
		linesDeleted: stats.linesDeleted,
		blankLinesSkipped: stats.blankSkipped,
		binaryFileDiffs: stats.binaryFiles,
		renames: stats.renames,
		churnedLines: churned,
		churnRatePct: stats.linesAdded ? +((churned / stats.linesAdded) * 100).toFixed(2) : 0,
		selfChurn: self,
		otherChurn: other,
		botAddedChurn: botChurn,
	};
}

const pct = (a, b) => (b ? `${((a / b) * 100).toFixed(1)}%` : '—');

async function main() {
	const args = process.argv.slice(2);
	const repos = args.length
		? args.map(a => ({ name: a.split('/').pop().replace(/\.git$/, ''), url: a }))
		: DEFAULT_REPOS;

	await mkdir(REPOS_DIR, { recursive: true });
	await mkdir(OUT_DIR, { recursive: true });

	const results = [];
	for (const repo of repos) {
		console.log(`\n=== ${repo.name} (${repo.url}) ===`);
		const t0 = Date.now();
		const dir = await ensureClone(repo);
		const cloneSec = ((Date.now() - t0) / 1000).toFixed(1);

		const t1 = Date.now();
		const { stats, files } = await parseRepo(dir);
		const parseSec = ((Date.now() - t1) / 1000).toFixed(1);

		const summary = summarize(stats, files);
		summary.cloneSec = +cloneSec;
		summary.parseSec = +parseSec;
		summary.linesPerSec = Math.round(stats.linesAdded / Math.max(1, +parseSec));

		const top = [...files.values()]
			.sort((a, b) => b.churned - a.churned || b.added - a.added)
			.slice(0, 10)
			.map(f => ({
				path: f.path,
				added: f.added,
				deleted: f.deleted,
				churned: f.churned,
				churnRatePct: f.added ? +((f.churned / f.added) * 100).toFixed(1) : 0,
				selfChurn: f.selfChurned,
				otherChurn: f.otherChurned,
				samples: f.samples,
			}));

		console.log(
			[
				`  clone ${cloneSec}s · parse ${parseSec}s (${summary.linesPerSec} added-lines/s)`,
				`  commits        ${summary.commits} (${pct(summary.botCommits, summary.commits)} bot)`,
				`  files touched  ${summary.filesTouched}`,
				`  lines added    ${summary.linesAdded}   deleted ${summary.linesDeleted}   (blank skipped ${summary.blankLinesSkipped})`,
				`  renames        ${summary.renames}   binary file-diffs ${summary.binaryFileDiffs}`,
				`  CHURNED        ${summary.churnedLines} lines within ${WINDOW_DAYS}d  →  ${summary.churnRatePct}% of all added lines`,
				`      self-churn ${summary.selfChurn} · other-churn ${summary.otherChurn} · from bot-added lines ${summary.botAddedChurn}`,
			].join('\n'),
		);

		let totalChurn = 0;
		let generatedChurn = 0;
		for (const f of files.values()) {
			totalChurn += f.churned;
			if (isGenerated(f.path)) generatedChurn += f.churned;
		}
		summary.generatedChurn = generatedChurn;
		summary.generatedChurnSharePct = totalChurn ? +((generatedChurn / totalChurn) * 100).toFixed(1) : 0;

		console.log(
			`  generated-file churn  ${generatedChurn} lines = ${summary.generatedChurnSharePct}% of all churn`,
		);

		console.log(`\n  top files by churned lines (raw, unfiltered):`);
		console.log(`  ${'churn'.padStart(6)} ${'rate'.padStart(6)} ${'added'.padStart(7)}  path`);
		for (const f of top) {
			console.log(
				`  ${String(f.churned).padStart(6)} ${(f.churnRatePct + '%').padStart(6)} ${String(
					f.added,
				).padStart(7)}  ${f.path}`,
			);
		}

		const topSource = [...files.values()]
			.filter(f => !isGenerated(f.path))
			.sort((a, b) => b.churned - a.churned || b.added - a.added)
			.slice(0, 10)
			.map(f => ({
				path: f.path,
				added: f.added,
				deleted: f.deleted,
				churned: f.churned,
				churnRatePct: f.added ? +((f.churned / f.added) * 100).toFixed(1) : 0,
				selfChurn: f.selfChurned,
				otherChurn: f.otherChurned,
				samples: f.samples,
			}));

		console.log(`\n  top SOURCE files (generated/vendored excluded) — what a user should see:`);
		console.log(`  ${'churn'.padStart(6)} ${'rate'.padStart(6)} ${'added'.padStart(7)}  path`);
		for (const f of topSource) {
			console.log(
				`  ${String(f.churned).padStart(6)} ${(f.churnRatePct + '%').padStart(6)} ${String(
					f.added,
				).padStart(7)}  ${f.path}`,
			);
		}

		const payload = {
			repo: repo.name,
			url: repo.url,
			windowDays: WINDOW_DAYS,
			summary,
			topFilesRaw: top,
			topFilesSource: topSource,
		};
		await writeFile(path.join(OUT_DIR, `${repo.name}.json`), `${JSON.stringify(payload, null, 2)}\n`);
		results.push(payload);
	}

	await writeFile(path.join(OUT_DIR, 'index.json'), `${JSON.stringify(results, null, 2)}\n`);
	console.log(`\nWrote JSON results to ${OUT_DIR}/`);
}

main().catch(err => {
	console.error(err);
	process.exit(1);
});
