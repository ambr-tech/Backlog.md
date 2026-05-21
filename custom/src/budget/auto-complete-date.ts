// [Custom] 完了状態への遷移時に completedDate を自動セットする

import type { BacklogConfig, Task } from "../../../src/types/index.ts";
import "./types.ts";
import { isCompletedStatus } from "./completed-statuses.ts";
import { getTodayYmd } from "./schema.ts";

/**
 * 編集時の自動セット。
 * - `prev` のステータスが完了状態でなく、`next` が完了状態になる場合に発火。
 * - 既に `completedDate` が設定済みなら上書きしない。
 * - 完了 → それ以外への遷移では `completedDate` を保持（クリアしない）。
 */
export function applyCompletedDateOnTransition(
	prev: Task | null | undefined,
	next: Task,
	config: BacklogConfig | null | undefined,
	now: Date = new Date(),
): Task {
	const wasCompleted = prev ? isCompletedStatus(prev.status, config) : false;
	const isNowCompleted = isCompletedStatus(next.status, config);
	if (!isNowCompleted) {
		return next;
	}
	if (wasCompleted) {
		return next;
	}
	if (typeof next.completedDate === "string" && next.completedDate.length > 0) {
		return next;
	}
	next.completedDate = getTodayYmd(now);
	return next;
}

/**
 * 作成時の自動セット。
 * - 新規タスクのステータスが完了状態であり、かつ `completedDate` が未設定なら今日を埋める。
 */
export function applyCompletedDateOnCreate(
	task: Task,
	config: BacklogConfig | null | undefined,
	now: Date = new Date(),
): Task {
	if (!isCompletedStatus(task.status, config)) return task;
	if (typeof task.completedDate === "string" && task.completedDate.length > 0) return task;
	task.completedDate = getTodayYmd(now);
	return task;
}
