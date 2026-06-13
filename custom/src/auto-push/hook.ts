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
	notifier?.("start");
	try {
		await git.push("origin", repoRoot ?? null);
		notifier?.("finished");
	} catch (error) {
		notifier?.("failed");
		if (process.env.DEBUG) {
			console.warn("[auto-push] push failed:", error);
		}
	}
}
