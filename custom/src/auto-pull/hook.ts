// [Custom] 自動プル機能: pull の発火と進捗通知をまとめる。
// 実装本体を custom に閉じ、upstream の server / GitOperations からは委譲呼び出しのみ行う。

export type PullPhase = "start" | "finished" | "failed";
export type PullNotifier = (phase: PullPhase) => void;

/** GitOperations のうち pull に必要な能力だけを表す疎結合インターフェース。 */
export interface PullCapable {
	pull(remote?: string, repoRoot?: string | null): Promise<boolean>;
}

// 通知関数はサーバー起動時にのみ登録される。CLI 単体実行では未登録 = 通知 no-op。
let notifier: PullNotifier | null = null;

/** pull 進捗の通知先を登録する（サーバー起動時）。null で解除（サーバー停止時）。 */
export function setAutoPullNotifier(fn: PullNotifier | null): void {
	notifier = fn;
}

// [Custom] 原因調査用ログ: auto-pull の各段階を `[auto-pull]` プレフィックス付きで標準エラーへ出す。
// pull 失敗の理由（git の stderr を含む execGit の throw）をヘッダの「プル失敗」表示だけでなく
// ログからも追えるよう常時出力する（auto-push の logAutoPush と同方針）。
function logAutoPull(message: string, detail?: unknown): void {
	if (detail === undefined) {
		console.error(`[auto-pull] ${message}`);
	} else {
		console.error(`[auto-pull] ${message}`, detail);
	}
}

/**
 * autoPull が有効なときに pull を実行する。
 *
 * - `enabled` が falsy の場合は何もしない（フラグ OFF）。
 * - pull 開始時に "start"、成功/スキップ時に "finished"、失敗時に "failed" を通知する。
 * - pull の失敗（ネットワーク断・認証・コンフリクト・ローカル変更衝突等）でも throw せず
 *   "failed" 通知に留める。定期実行ループを止めないため。
 */
export async function maybeAutoPull(
	git: PullCapable,
	enabled: boolean | undefined,
	repoRoot?: string | null,
): Promise<void> {
	if (!enabled) return;
	logAutoPull(`pull 開始: remote=origin repoRoot=${repoRoot ?? "(projectRoot)"}`);
	notifier?.("start");
	try {
		const pulled = await git.pull("origin", repoRoot ?? null);
		// pulled=false は pull() 内の事前条件（remoteOperations 無効 / filesystemOnly /
		// 非 git リポジトリ / remote 未設定）でスキップされたことを意味する。
		logAutoPull(pulled ? "pull 完了: pulled=true" : "pull スキップ: pulled=false (pull() の事前条件で未実行)");
		notifier?.("finished");
	} catch (error) {
		notifier?.("failed");
		// 調査の核心: git の実エラー（exit code と stderr を含む execGit の throw）をそのまま出す。
		logAutoPull("pull 失敗:", error);
		if (error instanceof Error && error.stack) {
			logAutoPull("pull 失敗 (stack):", error.stack);
		}
	}
}
