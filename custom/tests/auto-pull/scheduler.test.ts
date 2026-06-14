// [Custom] 自動プル機能: 定期 pull スケジューラのテスト（tick を直呼びして interval 非依存に検証）
import { describe, expect, test } from "bun:test";
import { AutoPullScheduler, type AutoPullSchedulerOptions } from "../../src/auto-pull/scheduler";

function makeScheduler(overrides: Partial<AutoPullSchedulerOptions>): {
	scheduler: AutoPullScheduler;
	runs: () => number;
} {
	let runs = 0;
	const options: AutoPullSchedulerOptions = {
		isEnabled: () => true,
		hasOpenPages: () => true,
		runPull: async () => {
			runs++;
		},
		intervalMs: 1000,
		...overrides,
	};
	return { scheduler: new AutoPullScheduler(options), runs: () => runs };
}

describe("AutoPullScheduler.tick", () => {
	test("フラグ OFF なら pull しない", async () => {
		const { scheduler, runs } = makeScheduler({ isEnabled: () => false });
		await scheduler.tick();
		expect(runs()).toBe(0);
	});

	test("開いているページが無ければ pull しない", async () => {
		const { scheduler, runs } = makeScheduler({ hasOpenPages: () => false });
		await scheduler.tick();
		expect(runs()).toBe(0);
	});

	test("有効かつ接続ありなら runPull を 1 回呼ぶ", async () => {
		const { scheduler, runs } = makeScheduler({});
		await scheduler.tick();
		expect(runs()).toBe(1);
	});

	test("前回の pull が継続中は二重起動しない（in-flight ガード）", async () => {
		let resolveFirst!: () => void;
		let runs = 0;
		let blockFirst = true;
		const scheduler = new AutoPullScheduler({
			isEnabled: () => true,
			hasOpenPages: () => true,
			runPull: () => {
				runs++;
				if (blockFirst) {
					// 1 回目だけ手動解決まで保留し、in-flight 状態を作る
					blockFirst = false;
					return new Promise<void>((r) => {
						resolveFirst = r;
					});
				}
				return Promise.resolve();
			},
			intervalMs: 1000,
		});
		const first = scheduler.tick(); // 走り出して未解決のまま
		await scheduler.tick(); // in-flight 中なのでスキップされる
		expect(runs).toBe(1);
		resolveFirst(); // 1 回目を完了させる
		await first;
		await scheduler.tick(); // 解放後は再び実行できる（即解決）
		expect(runs).toBe(2);
	});
});
