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
	// 最後に pull を開始した時刻（ミリ秒）。初期 0 = 初回は必ず即 pull。
	// 定期 tick とフォーカス取得イベントの両方がこの値を共有して interval ガードを通す。
	private lastPullAt = 0;

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
	 * interval ガードを通して 1 回分の pull を試みる共通入口。
	 * 定期 tick（setInterval）からも、フォーカス取得イベント（blur→focus）からも呼ばれる。
	 * `options.force` が true のときは interval ガードを無視して即 pull する（ページ新規アクセス時用）。
	 * 前回が継続中 / フラグ OFF / 開いているページが無い /（force でなく）前回 pull から interval 未経過、
	 * のいずれかなら何もしない。
	 */
	async maybePull(options?: { force?: boolean }): Promise<void> {
		const force = options?.force ?? false;
		if (this.inFlight) return; // 前回の pull が継続中
		if (!this.options.isEnabled()) return; // フラグ OFF
		if (!this.options.hasOpenPages()) return; // 開いているページが無い
		const now = Date.now();
		if (!force && now - this.lastPullAt < this.options.intervalMs) return; // interval 未経過（force 時は無視）
		this.lastPullAt = now; // 開始時刻を記録（連投は inFlight ガードが別途防ぐ）
		this.inFlight = true;
		try {
			await this.options.runPull();
		} finally {
			this.inFlight = false;
		}
	}

	/** 定期 tick の入口。interval ガード付きの maybePull に委譲する。 */
	async tick(): Promise<void> {
		await this.maybePull();
	}
}
