/**
 * Deterministic golden repos for the churn spike.
 *
 * Every fixture is built from scratch with fixed dates, fixed authors and fixed
 * content, so the expected churn is knowable by hand and the assertions can be
 * exact integers — not tolerances. This is what plan task T8 asks for as an exit
 * criterion ("unit tests for ingestion parser (golden mini-repos)").
 */

import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

const BASE_MS = Date.UTC(2020, 0, 1);
/** Day N of the fixture timeline, as a git-parseable ISO timestamp. */
export const day = n => new Date(BASE_MS + n * 86_400_000).toISOString();

const ALICE = 'alice@example.com';
const BOB = 'bob@example.com';

/**
 * Must be awaited properly — using the un-promisified execFile here silently
 * returns a ChildProcess instead of a promise, so commits race each other and
 * the fixture loses its changes.
 */
async function git(dir, args, env = {}) {
	const { stdout } = await run('git', ['-C', dir, ...args], {
		env: { ...process.env, ...env },
	});
	return stdout;
}

/**
 * Build a repo from a list of steps.
 *   { day, author?, email?, files: { 'path': 'content' | null }, rename?: [from, to] }
 * `null` content deletes the file. All dates/authors are pinned so the fixture
 * is byte-identical on every machine and every run.
 */
export async function makeRepo(steps) {
	const dir = await mkdtemp(path.join(tmpdir(), 'gitlens-spike-'));
	await run('git', ['init', '-q', '-b', 'main', dir]);
	await git(dir, ['config', 'core.autocrlf', 'false']);
	await git(dir, ['config', 'commit.gpgsign', 'false']);
	await git(dir, ['config', 'user.name', 'Fixture']);
	await git(dir, ['config', 'user.email', 'fixture@example.com']);

	for (const step of steps) {
		if (step.rename) {
			await git(dir, ['mv', ...step.rename]);
		}
		for (const [rel, content] of Object.entries(step.files ?? {})) {
			const full = path.join(dir, rel);
			if (content === null) {
				await rm(full, { force: true });
			} else {
				await mkdir(path.dirname(full), { recursive: true });
				await writeFile(full, content);
			}
		}
		await git(dir, ['add', '-A']);

		const name = step.author ?? 'Alice';
		const email = step.email ?? ALICE;
		const date = step.date;
		await git(
			dir,
			['commit', '-q', '--allow-empty', '-m', step.msg ?? `step@${step.date}`],
			{
				GIT_AUTHOR_NAME: name,
				GIT_AUTHOR_EMAIL: email,
				GIT_AUTHOR_DATE: date,
				GIT_COMMITTER_NAME: name,
				GIT_COMMITTER_EMAIL: email,
				GIT_COMMITTER_DATE: date,
			},
		);
	}
	return dir;
}

export async function cleanup(dir) {
	if (dir) await rm(dir, { recursive: true, force: true });
}

export { ALICE, BOB };
