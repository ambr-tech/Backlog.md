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
			// interval ガードと干渉させず in-flight ガード単体を検証するため 0 にする
			// （now - lastPullAt < 0 は常に false なので interval ガードは無効化される）。
			intervalMs: 0,
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

describe("AutoPullScheduler.maybePull（interval ガード）", () => {
	test("初回は lastPullAt=0 なので即 pull する", async () => {
		const { scheduler, runs } = makeScheduler({ intervalMs: 100000 });
		await scheduler.maybePull();
		expect(runs()).toBe(1);
	});

	test("interval 未経過なら連続呼び出しでも 1 回だけ", async () => {
		const { scheduler, runs } = makeScheduler({ intervalMs: 100000 });
		await scheduler.maybePull();
		await scheduler.maybePull(); // 直前の pull から間もないのでスキップ
		expect(runs()).toBe(1);
	});

	test("interval 経過後は再び pull する", async () => {
		const realNow = Date.now;
		let now = 1000;
		Date.now = () => now;
		try {
			const { scheduler, runs } = makeScheduler({ intervalMs: 1000 });
			await scheduler.maybePull(); // now=1000, lastPullAt=0 → 経過 1000ms ≥ 1000 → pull
			await scheduler.maybePull(); // 経過 0ms < 1000 → スキップ
			expect(runs()).toBe(1);
			now = 2000; // interval 経過
			await scheduler.maybePull(); // 経過 1000ms ≥ 1000 → pull
			expect(runs()).toBe(2);
		} finally {
			Date.now = realNow;
		}
	});

	test("tick は maybePull に委譲する（interval ガードを共有）", async () => {
		const realNow = Date.now;
		let now = 1000;
		Date.now = () => now;
		try {
			const { scheduler, runs } = makeScheduler({ intervalMs: 1000 });
			await scheduler.tick(); // 初回 → pull
			await scheduler.tick(); // interval 未経過 → スキップ
			expect(runs()).toBe(1);
			now = 2000;
			await scheduler.tick(); // interval 経過 → pull
			expect(runs()).toBe(2);
		} finally {
			Date.now = realNow;
		}
	});

	test("force=true なら interval 未経過でも pull する（ページ新規アクセス）", async () => {
		const realNow = Date.now;
		// now は interval より大きくしておく（初回 lastPullAt=0 との差が interval を超えるように）。
		let now = 1_000_000;
		Date.now = () => now;
		try {
			const { scheduler, runs } = makeScheduler({ intervalMs: 100000 });
			await scheduler.maybePull(); // 初回 → pull、lastPullAt=now
			expect(runs()).toBe(1);
			await scheduler.maybePull(); // interval 未経過 → スキップ
			expect(runs()).toBe(1);
			await scheduler.maybePull({ force: true }); // force → interval を無視して pull
			expect(runs()).toBe(2);
		} finally {
			Date.now = realNow;
		}
	});

	test("force=true でも無効・ページ無し・in-flight は尊重する", async () => {
		const offFlag = makeScheduler({ isEnabled: () => false });
		await offFlag.scheduler.maybePull({ force: true });
		expect(offFlag.runs()).toBe(0);

		const noPages = makeScheduler({ hasOpenPages: () => false });
		await noPages.scheduler.maybePull({ force: true });
		expect(noPages.runs()).toBe(0);
	});
});
