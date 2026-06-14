// [Custom] 自動プル機能: pull の発火と進捗通知をまとめる。
// 実装本体を custom に閉じ、upstream の server / GitOperations からは委譲呼び出しのみ行う。

export type PullPhase = "start" | "finished" | "failed";
export type PullNotifier = (phase: PullPhase) => void;

/** GitOperations のうち pull に必要な能力だけを表す疎結合インターフェース。 */
export interface PullCapable {
	pull(remote?: string, repoRoot?: string | null): Promise<boolean>;
	/** 現在の HEAD コミットハッシュ。取得できなければ null。pull 前後の差分判定に使う。 */
	getCurrentCommitHash(repoRoot?: string | null): Promise<string | null>;
}

// 通知関数はサーバー起動時にのみ登録される。CLI 単体実行では未登録 = 通知 no-op。
let notifier: PullNotifier | null = null;

/** pull 進捗の通知先を登録する（サーバー起動時）。null で解除（サーバー停止時）。 */
export function setAutoPullNotifier(fn: PullNotifier | null): void {
	notifier = fn;
}

// [Custom] 原因調査用ログ: pull 失敗時のみ `[auto-pull]` プレフィックス付きで標準エラーへ出す。
// pull 失敗の理由（git の stderr を含む execGit の throw）をヘッダの「プル失敗」表示だけでなく
// ログからも追えるようにする（auto-push の logAutoPush と同方針）。
// 正常系（開始/完了/スキップ）は定期実行のたびに大量出力されノイズになるため記録しない。
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
 *
 * 戻り値は「HEAD（コミット位置）が変化したか」= 画面更新（再取得）を促すべきか。
 * - フラグ OFF / pull スキップ / pull 失敗: false。
 * - pull 成功かつ pull 前後で HEAD が変化: true。同じなら false（取り込む差分が無かった）。
 * - HEAD ハッシュが取得できなかった場合は安全側に倒して true（従来どおり更新）。
 */
export async function maybeAutoPull(
	git: PullCapable,
	enabled: boolean | undefined,
	repoRoot?: string | null,
): Promise<boolean> {
	if (!enabled) return false;
	notifier?.("start");
	try {
		const before = await git.getCurrentCommitHash(repoRoot ?? null);
		// pulled（事前条件スキップ時 false）は通知のためにも使う。
		const pulled = await git.pull("origin", repoRoot ?? null);
		notifier?.("finished");
		if (!pulled) return false;
		const after = await git.getCurrentCommitHash(repoRoot ?? null);
		// どちらかが取得できなければ判定不能 → 安全側（更新する）に倒す。
		if (before === null || after === null) return true;
		return before !== after;
	} catch (error) {
		notifier?.("failed");
		// 調査の核心: git の実エラー（exit code と stderr を含む execGit の throw）をそのまま出す。
		logAutoPull("pull 失敗:", error);
		if (error instanceof Error && error.stack) {
			logAutoPull("pull 失敗 (stack):", error.stack);
		}
		return false;
	}
}
