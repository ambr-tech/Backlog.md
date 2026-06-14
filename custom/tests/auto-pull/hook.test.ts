// [Custom] 自動プル機能: pull 発火フックのテスト
import { describe, expect, test } from "bun:test";
import { maybeAutoPull, type PullCapable, type PullPhase, setAutoPullNotifier } from "../../src/auto-pull/hook";

/**
 * pull のモック。pull の戻り値（実行したか）と、HEAD ハッシュの推移を指定できる。
 * `hashes` は getCurrentCommitHash が呼ばれるたびに先頭から順に返す（before, after の順）。
 */
function makeGit(
	impl: () => Promise<boolean>,
	hashes: Array<string | null> = ["c0", "c0"],
): { git: PullCapable; calls: () => number } {
	let count = 0;
	let hashIndex = 0;
	const git: PullCapable = {
		pull: async () => {
			count++;
			return impl();
		},
		getCurrentCommitHash: async () => {
			const value = hashes[hashIndex] ?? hashes[hashes.length - 1] ?? null;
			hashIndex++;
			return value;
		},
	};
	return { git, calls: () => count };
}

describe("maybeAutoPull", () => {
	test("enabled=false なら pull しない", async () => {
		const { git, calls } = makeGit(async () => true);
		const changed = await maybeAutoPull(git, false);
		expect(calls()).toBe(0);
		expect(changed).toBe(false);
	});

	test("enabled が undefined でも pull しない", async () => {
		const { git, calls } = makeGit(async () => true);
		const changed = await maybeAutoPull(git, undefined);
		expect(calls()).toBe(0);
		expect(changed).toBe(false);
	});

	test("enabled=true で pull し、start→finished を通知", async () => {
		const phases: PullPhase[] = [];
		setAutoPullNotifier((p) => phases.push(p));
		const { git, calls } = makeGit(async () => true);
		await maybeAutoPull(git, true, "/repo");
		expect(calls()).toBe(1);
		expect(phases).toEqual(["start", "finished"]);
		setAutoPullNotifier(null);
	});

	test("pull 成功で HEAD が変化したら true（更新を促す）", async () => {
		const { git } = makeGit(async () => true, ["c0", "c1"]);
		const changed = await maybeAutoPull(git, true);
		expect(changed).toBe(true);
	});

	test("pull 成功でも HEAD が不変なら false（更新しない）", async () => {
		const { git } = makeGit(async () => true, ["c0", "c0"]);
		const changed = await maybeAutoPull(git, true);
		expect(changed).toBe(false);
	});

	test("HEAD ハッシュが取得できなければ true（安全側で更新）", async () => {
		const { git } = makeGit(async () => true, [null, null]);
		const changed = await maybeAutoPull(git, true);
		expect(changed).toBe(true);
	});

	test("pull がスキップ(false)でも finished を通知（表示を消す）、戻り値は false", async () => {
		const phases: PullPhase[] = [];
		setAutoPullNotifier((p) => phases.push(p));
		const { git } = makeGit(async () => false);
		const changed = await maybeAutoPull(git, true);
		expect(phases).toEqual(["start", "finished"]);
		expect(changed).toBe(false);
		setAutoPullNotifier(null);
	});

	test("pull 失敗時は failed を通知し、re-throw しない、戻り値は false", async () => {
		const phases: PullPhase[] = [];
		setAutoPullNotifier((p) => phases.push(p));
		const { git } = makeGit(async () => {
			throw new Error("boom");
		});
		const changed = await maybeAutoPull(git, true);
		expect(phases).toEqual(["start", "failed"]);
		expect(changed).toBe(false);
		setAutoPullNotifier(null);
	});

	test("notifier 未登録（CLI 相当）でも例外なく完走する", async () => {
		setAutoPullNotifier(null);
		const { git, calls } = makeGit(async () => true);
		await maybeAutoPull(git, true);
		expect(calls()).toBe(1);
	});
});
