// [Custom] 自動プッシュ機能: push の発火と進捗通知をまとめる。
// 実装本体を custom に閉じ、upstream の GitOperations からは委譲呼び出しのみ行う。

export type PushPhase = "start" | "finished" | "failed";
export type PushNotifier = (phase: PushPhase) => void;

/** GitOperations のうち push に必要な能力だけを表す疎結合インターフェース。 */
export interface PushCapable {
	push(remote?: string, repoRoot?: string | null): Promise<boolean>;
}

// 通知関数はサーバー起動時にのみ登録される。CLI 単体実行では未登録 = 通知 no-op。
let notifier: PushNotifier | null = null;

/** push 進捗の通知先を登録する（サーバー起動時）。null で解除（サーバー停止時）。 */
export function setAutoPushNotifier(fn: PushNotifier | null): void {
	notifier = fn;
}

// [Custom] 原因調査用ログ: auto-push の各段階を `[auto-push]` プレフィックス付きで標準エラーへ出す。
// push 失敗の理由（git の stderr を含む execGit の throw）は従来 DEBUG 時のみ出していたため
// ヘッダの「プッシュ失敗」表示だけで原因が追えなかった。調査のため常時出力する。
function logAutoPush(message: string, detail?: unknown): void {
	if (detail === undefined) {
		console.error(`[auto-push] ${message}`);
	} else {
		console.error(`[auto-push] ${message}`, detail);
	}
}

/**
 * autoPush が有効なときに push を実行する。
 *
 * - `enabled` が falsy の場合は何もしない（フラグ OFF）。
 * - push 開始時に "start"、成功/スキップ時に "finished"、失敗時に "failed" を通知する。
 * - push の失敗（ネットワーク断・認証・non-fast-forward 等）でも throw せず "failed" 通知に留める。
 *   コミットは既に成功しているため、push 失敗で操作全体を失敗させない。
 */
export async function maybeAutoPush(
	git: PushCapable,
	enabled: boolean | undefined,
	repoRoot?: string | null,
): Promise<void> {
	if (!enabled) return;
	// 正常系（開始/完了）は毎コミットのノイズを避けるため DEBUG 時のみ。失敗ログは常時出す。
	if (process.env.DEBUG) {
		logAutoPush(`push 開始: remote=origin repoRoot=${repoRoot ?? "(projectRoot)"}`);
	}
	notifier?.("start");
	try {
		const pushed = await git.push("origin", repoRoot ?? null);
		// pushed=false は push() 内の事前条件（remoteOperations 無効 / filesystemOnly /
		// 非 git リポジトリ / remote 未設定）でスキップされたことを意味する。
		if (process.env.DEBUG) {
			logAutoPush(pushed ? "push 完了: pushed=true" : "push スキップ: pushed=false (push() の事前条件で未実行)");
		}
		notifier?.("finished");
	} catch (error) {
		notifier?.("failed");
		// 調査の核心: git の実エラー（exit code と stderr を含む execGit の throw）をそのまま出す。
		logAutoPush("push 失敗:", error);
		if (error instanceof Error && error.stack) {
			logAutoPush("push 失敗 (stack):", error.stack);
		}
	}
}
