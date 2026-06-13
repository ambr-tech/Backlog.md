// [Custom] 自動プッシュ機能: push 発火フックのテスト
import { describe, expect, test } from "bun:test";
import { maybeAutoPush, type PushCapable, type PushPhase, setAutoPushNotifier } from "../../src/auto-push/hook";

function makeGit(impl: () => Promise<boolean>): { git: PushCapable; calls: () => number } {
	let count = 0;
	const git: PushCapable = {
		push: async () => {
			count++;
			return impl();
		},
	};
	return { git, calls: () => count };
}

describe("maybeAutoPush", () => {
	test("enabled=false なら push しない", async () => {
		const { git, calls } = makeGit(async () => true);
		await maybeAutoPush(git, false);
		expect(calls()).toBe(0);
	});

	test("enabled が undefined でも push しない", async () => {
		const { git, calls } = makeGit(async () => true);
		await maybeAutoPush(git, undefined);
		expect(calls()).toBe(0);
	});

	test("enabled=true で push し、start→finished を通知", async () => {
		const phases: PushPhase[] = [];
		setAutoPushNotifier((p) => phases.push(p));
		const { git, calls } = makeGit(async () => true);
		await maybeAutoPush(git, true, "/repo");
		expect(calls()).toBe(1);
		expect(phases).toEqual(["start", "finished"]);
		setAutoPushNotifier(null);
	});

	test("push がスキップ(false)でも finished を通知（表示を消す）", async () => {
		const phases: PushPhase[] = [];
		setAutoPushNotifier((p) => phases.push(p));
		const { git } = makeGit(async () => false);
		await maybeAutoPush(git, true);
		expect(phases).toEqual(["start", "finished"]);
		setAutoPushNotifier(null);
	});

	test("push 失敗時は failed を通知し、re-throw しない", async () => {
		const phases: PushPhase[] = [];
		setAutoPushNotifier((p) => phases.push(p));
		const { git } = makeGit(async () => {
			throw new Error("boom");
		});
		await maybeAutoPush(git, true);
		expect(phases).toEqual(["start", "failed"]);
		setAutoPushNotifier(null);
	});

	test("notifier 未登録（CLI 相当）でも例外なく完走する", async () => {
		setAutoPushNotifier(null);
		const { git, calls } = makeGit(async () => true);
		await maybeAutoPush(git, true);
		expect(calls()).toBe(1);
	});
});
