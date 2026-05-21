// [Custom] CLI / MCP / Web UI からの create/edit 入力を Task に反映するヘルパ

import type { Task, TaskCreateInput, TaskUpdateInput } from "../../../src/types/index.ts";
import "./types.ts";
import { normalizeCompletedDateValue, normalizeDaysValue } from "./schema.ts";

/**
 * TaskCreateInput の budget フィールドを検証して Task に適用。
 */
export function applyBudgetCreateInput(task: Task, input: TaskCreateInput): Task {
	const estimated = normalizeDaysValue(input.estimatedDays, "estimatedDays");
	if (typeof estimated === "number") {
		task.estimatedDays = estimated;
	}
	const actual = normalizeDaysValue(input.actualDays, "actualDays");
	if (typeof actual === "number") {
		task.actualDays = actual;
	}
	const completed = normalizeCompletedDateValue(input.completedDate, "completedDate");
	if (typeof completed === "string") {
		task.completedDate = completed;
	}
	return task;
}

/**
 * TaskUpdateInput の budget フィールドを Task に適用。
 * `null` = クリア、`undefined` = 変更なし、`number/string` = 設定。
 * mutated は変更があったかどうかを返す。
 */
export function applyBudgetUpdateInput(task: Task, input: TaskUpdateInput): { mutated: boolean } {
	let mutated = false;

	const estimated = normalizeDaysValue(input.estimatedDays, "estimatedDays");
	if (estimated !== undefined) {
		if (estimated === null) {
			if (task.estimatedDays !== undefined) {
				task.estimatedDays = undefined;
				mutated = true;
			}
		} else if (task.estimatedDays !== estimated) {
			task.estimatedDays = estimated;
			mutated = true;
		}
	}

	const actual = normalizeDaysValue(input.actualDays, "actualDays");
	if (actual !== undefined) {
		if (actual === null) {
			if (task.actualDays !== undefined) {
				task.actualDays = undefined;
				mutated = true;
			}
		} else if (task.actualDays !== actual) {
			task.actualDays = actual;
			mutated = true;
		}
	}

	const completed = normalizeCompletedDateValue(input.completedDate, "completedDate");
	if (completed !== undefined) {
		if (completed === null) {
			if (task.completedDate !== undefined) {
				task.completedDate = undefined;
				mutated = true;
			}
		} else if (task.completedDate !== completed) {
			task.completedDate = completed;
			mutated = true;
		}
	}

	return { mutated };
}
