// [Custom] Assignee / Labels 入力で文字が消える事象の原因調査用デバッグログ
//
// 現象: WebUI で Assignee / Labels に文字列を入力し、Enter またはサジェスト選択を行うと
//       入力した文字列が消え、チップとして追加されないまま入力前の状態に戻ることがある。
//       発生するときとしないときがあり、再現条件が不明。
//
// 仮説: commit → onChange → handleInlineMetaUpdate → updateTask (await) の間、または
//       直後の refreshData() で tasks が再取得され、App.tsx の useEffect が editingTask を
//       更新 → TaskDetailsModal の useEffect が走り setAssignee / setLabels が古い値で
//       state を巻き戻している可能性がある。WebSocket "tasks-updated" でのレースも疑い。
//
// このログ群は原因特定後に削除すること。
// 無効化したい場合はブラウザコンソールで以下を実行:
//   window.__SUGGEST_CHIP_DEBUG__ = false

declare global {
	interface Window {
		__SUGGEST_CHIP_DEBUG__?: boolean;
	}
}

let counter = 0;

function isEnabled(): boolean {
	if (typeof window === "undefined") return false;
	return window.__SUGGEST_CHIP_DEBUG__ !== false;
}

function snapshot(payload?: Record<string, unknown>): Record<string, unknown> | undefined {
	if (!payload) return undefined;
	try {
		// 後続の mutation で値が変わるのを防ぐためディープコピー
		return JSON.parse(JSON.stringify(payload));
	} catch {
		return { __unserializable: true, keys: Object.keys(payload) };
	}
}

export function debugLog(scope: string, event: string, payload?: Record<string, unknown>): void {
	if (!isEnabled()) return;
	counter += 1;
	const ts = new Date().toISOString().slice(11, 23);
	const seq = String(counter).padStart(4, "0");
	// eslint-disable-next-line no-console
	console.log(`[SuggestChipDebug #${seq} ${ts}] ${scope} · ${event}`, snapshot(payload) ?? "");
}

export {};
