// [Custom] 自動プッシュ機能: push 進捗を WebSocket でブロードキャストする。
// 既存の `ws.send("tasks-updated")` と同じ素朴な文字列メッセージ方式に合わせる。

import type { ServerWebSocket } from "bun";
import type { PushNotifier, PushPhase } from "./hook.ts";

const PHASE_MESSAGE: Record<PushPhase, string> = {
	start: "push-started",
	finished: "push-finished",
	failed: "push-failed",
};

/**
 * サーバーの socket 集合へ push 進捗メッセージを送る通知関数を生成する。
 * `getSockets` は最新の socket 群を都度返すこと（接続増減に追従するため）。
 */
export function makeAutoPushBroadcaster(getSockets: () => Iterable<ServerWebSocket<unknown>>): PushNotifier {
	return (phase) => {
		const message = PHASE_MESSAGE[phase];
		for (const ws of getSockets()) {
			try {
				ws.send(message);
			} catch {}
		}
	};
}
