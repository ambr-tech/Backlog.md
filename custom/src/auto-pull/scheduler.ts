// [Custom] 自動プル機能: Web UI を開いている間、定期的に pull を実行するスケジューラ。
// 「ページを開いている間」= 接続中の WebSocket が 1 本以上ある間、と解釈する。
// in-flight ガードにより、前回の pull が終わるまで次の pull を投入しない（無駄な連投・
// ミューテックス待ちの積み上がりを防ぐ）。

export const DEFAULT_AUTO_PULL_INTERVAL_SECONDS = 60;

export interface AutoPullSchedulerOptions {
	/** 自動プルが有効か（config.autoPull を毎 tick 評価する想定）。 */
	isEnabled: () => boolean | undefined;
	/** 開いているページがあるか（例: () => sockets.size > 0）。 */
	hasOpenPages: () => boolean;
	/** 実際の pull 実行（内部で maybeAutoPull を呼ぶ）。 */
	runPull: () => Promise<void>;
	/** pull 間隔（ミリ秒）。 */
	intervalMs: number;
}

export class AutoPullScheduler {
	private timer: ReturnType<typeof setInterval> | null = null;
	private inFlight = false;

	constructor(private readonly options: AutoPullSchedulerOptions) {}

	/** 定期 pull を開始する。多重 start はガードする。 */
	start(): void {
		if (this.timer) return;
		this.timer = setInterval(() => {
			void this.tick();
		}, this.options.intervalMs);
	}

	/** 定期 pull を停止する。 */
	stop(): void {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = null;
		}
	}

	/**
	 * 1 回分の pull 判定と実行。interval 無しで単体テストできるよう分離している。
	 * 前回が継続中 / フラグ OFF / 開いているページが無い、のいずれかなら何もしない。
	 */
	async tick(): Promise<void> {
		if (this.inFlight) return; // 前回の pull が継続中
		if (!this.options.isEnabled()) return; // フラグ OFF
		if (!this.options.hasOpenPages()) return; // 開いているページが無い
		this.inFlight = true;
		try {
			await this.options.runPull();
		} finally {
			this.inFlight = false;
		}
	}
}
