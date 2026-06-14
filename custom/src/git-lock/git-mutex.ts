// [Custom] git操作の直列化: pull / push / commit / add などの git プロセスが
// 同時に走って index.lock 競合や index 不整合を起こさないよう、全 git コマンドを
// 単一のキューで直列実行する。GitOperations.execGit から利用する。
//
// プロセス内で git 操作は単一リポジトリを対象とする前提のため、モジュールレベルで
// 1 本のロック（Promise チェーン）を保持する。

let tail: Promise<unknown> = Promise.resolve();

/**
 * fn を、直前までにキューされた git 操作がすべて完了したあとに実行する。
 * 直前の操作が失敗 (reject) しても後続は実行する（ロックを詰まらせない）。
 * 戻り値の Promise は fn 自身の結果 / エラーをそのまま呼び出し側へ伝える。
 */
export function runGitExclusive<T>(fn: () => Promise<T>): Promise<T> {
	// 直前の操作の成否に関わらず fn を実行する（then の両ハンドラに fn を渡す）。
	const run = tail.then(fn, fn);
	// チェーンの末尾は常に解決状態にして、後続が前の失敗で止まらないようにする。
	tail = run.then(
		() => undefined,
		() => undefined,
	);
	return run;
}
