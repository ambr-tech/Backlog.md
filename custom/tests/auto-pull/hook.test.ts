// [Custom] 自動プル機能: pull 発火フックのテスト
import { describe, expect, test } from "bun:test";
import { maybeAutoPull, type PullCapable, type PullPhase, setAutoPullNotifier } from "../../src/auto-pull/hook";

function makeGit(impl: () => Promise<boolean>): { git: PullCapable; calls: () => number } {
	let count = 0;
	const git: PullCapable = {
		pull: async () => {
			count++;
			return impl();
		},
	};
	return { git, calls: () => count };
}

describe("maybeAutoPull", () => {
	test("enabled=false なら pull しない", async () => {
		const { git, calls } = makeGit(async () => true);
		await maybeAutoPull(git, false);
		expect(calls()).toBe(0);
	});

	test("enabled が undefined でも pull しない", async () => {
		const { git, calls } = makeGit(async () => true);
		await maybeAutoPull(git, undefined);
		expect(calls()).toBe(0);
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

	test("pull がスキップ(false)でも finished を通知（表示を消す）", async () => {
		const phases: PullPhase[] = [];
		setAutoPullNotifier((p) => phases.push(p));
		const { git } = makeGit(async () => false);
		await maybeAutoPull(git, true);
		expect(phases).toEqual(["start", "finished"]);
		setAutoPullNotifier(null);
	});

	test("pull 失敗時は failed を通知し、re-throw しない", async () => {
		const phases: PullPhase[] = [];
		setAutoPullNotifier((p) => phases.push(p));
		const { git } = makeGit(async () => {
			throw new Error("boom");
		});
		await maybeAutoPull(git, true);
		expect(phases).toEqual(["start", "failed"]);
		setAutoPullNotifier(null);
	});

	test("notifier 未登録（CLI 相当）でも例外なく完走する", async () => {
		setAutoPullNotifier(null);
		const { git, calls } = makeGit(async () => true);
		await maybeAutoPull(git, true);
		expect(calls()).toBe(1);
	});
});
