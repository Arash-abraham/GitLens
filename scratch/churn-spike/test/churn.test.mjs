/**
 * Golden-repo tests for the churn spike.
 *
 *   node --test scratch/churn-spike/test/
 *
 * No test framework, no install, no registry — Node's built-in runner only.
 * That is deliberate: `npm ci` is currently broken (lockfile points at a private
 * mirror), so a test suite that needs installing would not run at all.
 *
 * Every expected value below was derived by hand from the fixture timeline,
 * not read back from the implementation.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { parseRepo, WINDOW_DAYS } from '../analyze.mjs';
import { makeRepo, cleanup, day, BOB } from './fixtures.mjs';

/** Run the parser over a fixture and return a compact, assertable shape. */
async function churn(steps) {
	const dir = await makeRepo(steps);
	try {
		const { stats, files } = await parseRepo(dir);
		let churned = 0;
		let self = 0;
		let other = 0;
		for (const f of files.values()) {
			churned += f.churned;
			self += f.selfChurned;
			other += f.otherChurned;
		}
		return {
			dir,
			commits: stats.commits,
			added: stats.linesAdded,
			deleted: stats.linesDeleted,
			blankSkipped: stats.blankSkipped,
			renames: stats.renames,
			churned,
			self,
			other,
			files,
			stats,
		};
	} finally {
		await cleanup(dir);
	}
}

test('window constant is what the metric contract says', () => {
	assert.equal(WINDOW_DAYS, 21);
});

test('a line deleted by its own author counts as self-churn', async () => {
	const r = await churn([
		{ date: day(0), files: { 'a.txt': 'one\ntwo\nthree\n' } },
		{ date: day(1), files: { 'a.txt': 'one\nthree\n' } },
	]);
	assert.equal(r.commits, 2);
	assert.equal(r.added, 3);
	assert.equal(r.deleted, 1);
	assert.equal(r.churned, 1, 'one line removed within the window');
	assert.equal(r.self, 1);
	assert.equal(r.other, 0);
});

test('a line deleted by a different author counts as other-churn', async () => {
	const r = await churn([
		{ date: day(0), files: { 'a.txt': 'one\ntwo\nthree\n' } },
		{ date: day(1), author: 'Bob', email: BOB, files: { 'a.txt': 'one\nthree\n' } },
	]);
	assert.equal(r.churned, 1);
	assert.equal(r.self, 0);
	assert.equal(r.other, 1);
});

test('a line deleted AFTER the window is not churn', async () => {
	const r = await churn([
		{ date: day(0), files: { 'a.txt': 'one\ntwo\nthree\n' } },
		{ date: day(30), files: { 'a.txt': 'one\nthree\n' } },
	]);
	assert.equal(r.deleted, 1, 'the deletion is seen');
	assert.equal(r.churned, 0, 'but it is outside the 21-day window');
});

test('the window boundary is inclusive at exactly 21 days', async () => {
	const inside = await churn([
		{ date: day(0), files: { 'a.txt': 'one\ntwo\nthree\n' } },
		{ date: day(21), files: { 'a.txt': 'one\nthree\n' } },
	]);
	assert.equal(inside.churned, 1, 'day 21 is inside the window');

	const outside = await churn([
		{ date: day(0), files: { 'a.txt': 'one\ntwo\nthree\n' } },
		{ date: day(22), files: { 'a.txt': 'one\nthree\n' } },
	]);
	assert.equal(outside.churned, 0, 'day 22 is outside the window');
});

test('a line that is never deleted is not churn', async () => {
	const r = await churn([
		{ date: day(0), files: { 'a.txt': 'one\ntwo\n' } },
		{ date: day(1), files: { 'a.txt': 'one\ntwo\nthree\n' } },
	]);
	assert.equal(r.added, 3);
	assert.equal(r.deleted, 0);
	assert.equal(r.churned, 0);
});

test('duplicate lines are matched LIFO, one deletion churns one addition', async () => {
	const r = await churn([
		{ date: day(0), files: { 'a.txt': 'x\nx\n' } },
		{ date: day(5), files: { 'a.txt': 'x\n' } },
	]);
	assert.equal(r.added, 2);
	assert.equal(r.deleted, 1);
	assert.equal(r.churned, 1, 'only one of the two additions is churned');
});

test('churn survives a rename: added at old path, deleted at new path', async () => {
	const r = await churn([
		{ date: day(0), files: { 'a.txt': 'one\ntwo\nthree\n' } },
		{ date: day(1), rename: ['a.txt', 'b.txt'] },
		{ date: day(2), files: { 'b.txt': 'one\nthree\n' } },
	]);
	assert.equal(r.renames, 1, 'the rename is detected and folded');
	assert.equal(r.churned, 1, 'the line added before the rename still matches');
	assert.ok(r.files.has('b.txt'), 'history is carried to the new path');
	assert.ok(!r.files.has('a.txt'), 'and removed from the old one');
});

test('blank lines are excluded from both adds and deletes', async () => {
	const r = await churn([
		{ date: day(0), files: { 'a.txt': '\n\nfoo\n\n' } },
		{ date: day(1), files: { 'a.txt': 'foo\n' } },
	]);
	assert.equal(r.added, 1, 'only "foo" counts as added');
	// "\n\nfoo\n\n" is 4 lines: "", "", "foo", "" — 3 blanks added, then 3 blanks
	// removed in the second commit. Both directions are skipped, so 6 not 3.
	assert.equal(r.blankSkipped, 6);
	assert.equal(r.deleted, 0, 'removing blank lines produces no churn');
	assert.equal(r.churned, 0);
});

test('a whole-file deletion is currently counted as 100% churn', async () => {
	// KNOWN FALSE POSITIVE — documented in README. This test pins the current
	// behaviour so the fix is a deliberate, visible change, not a surprise.
	const r = await churn([
		{ date: day(0), files: { 'a.txt': 'one\ntwo\n' } },
		{ date: day(1), files: { 'a.txt': null } },
	]);
	assert.equal(r.added, 2);
	assert.equal(r.deleted, 2);
	assert.equal(r.churned, 2, 'both lines match their own earlier addition');
});

test('expired pending lines are pruned and do not match later deletions', async () => {
	// Add, wait past the window, add again, then delete one copy.
	const r = await churn([
		{ date: day(0), files: { 'a.txt': 'old\n' } },
		{ date: day(40), files: { 'a.txt': 'old\nnew\n' } },
		{ date: day(41), files: { 'a.txt': 'old\n' } },
	]);
	// day-0 "old" is long expired; day-40 "new" is deleted within the window.
	assert.equal(r.churned, 1);
	assert.equal(r.self, 1);
});
