// [Custom] 自動プル機能: pull 進捗を WebSocket でブロードキャストする。
// 既存の `ws.send("tasks-updated")` と同じ素朴な文字列メッセージ方式に合わせる。

import type { ServerWebSocket } from "bun";
import type { PullNotifier, PullPhase } from "./hook.ts";

const PHASE_MESSAGE: Record<PullPhase, string> = {
	start: "pull-started",
	finished: "pull-finished",
	failed: "pull-failed",
};

/**
 * サーバーの socket 集合へ pull 進捗メッセージを送る通知関数を生成する。
 * `getSockets` は最新の socket 群を都度返すこと（接続増減に追従するため）。
 */
export function makeAutoPullBroadcaster(getSockets: () => Iterable<ServerWebSocket<unknown>>): PullNotifier {
	return (phase) => {
		const message = PHASE_MESSAGE[phase];
		for (const ws of getSockets()) {
			try {
				ws.send(message);
			} catch {}
		}
	};
}
