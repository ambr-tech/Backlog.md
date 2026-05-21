// [Custom] 予算管理機能の frontmatter ↔ Task のマッピング

import type { Task } from "../../../src/types/index.ts";
import "./types.ts";
import { isValidYmdDate, roundTo2 } from "./schema.ts";

const ESTIMATED_KEY = "estimated_days";
const ACTUAL_KEY = "actual_days";
const COMPLETED_DATE_KEY = "completed_date";

type RawFrontmatter = Record<string, unknown>;

/**
 * frontmatter から Task の budget フィールド (estimatedDays / actualDays / completedDate) を読み出して付与する。
 * upstream の parseTask 完了後に呼び出される想定。
 */
export function applyBudgetFromFrontmatter(task: Task, frontmatter: RawFrontmatter): Task {
	const estimated = parseNumberLike(frontmatter[ESTIMATED_KEY]);
	if (estimated !== undefined) {
		task.estimatedDays = estimated;
	}
	const actual = parseNumberLike(frontmatter[ACTUAL_KEY]);
	if (actual !== undefined) {
		task.actualDays = actual;
	}
	const completed = parseDateLike(frontmatter[COMPLETED_DATE_KEY]);
	if (completed !== undefined) {
		task.completedDate = completed;
	}
	return task;
}

/**
 * Task の budget フィールドを frontmatter オブジェクトにマージして返す。
 * 値が `undefined` のキーは出力しない（差分最小化）。
 */
export function applyBudgetToFrontmatter<T extends Record<string, unknown>>(frontmatter: T, task: Task): T {
	const result = frontmatter as Record<string, unknown>;
	if (typeof task.estimatedDays === "number" && Number.isFinite(task.estimatedDays)) {
		result[ESTIMATED_KEY] = roundTo2(task.estimatedDays);
	}
	if (typeof task.actualDays === "number" && Number.isFinite(task.actualDays)) {
		result[ACTUAL_KEY] = roundTo2(task.actualDays);
	}
	if (typeof task.completedDate === "string" && task.completedDate.length > 0) {
		result[COMPLETED_DATE_KEY] = task.completedDate;
	}
	return frontmatter;
}

function parseNumberLike(value: unknown): number | undefined {
	if (value === undefined || value === null || value === "") return undefined;
	const num = typeof value === "number" ? value : Number(value);
	if (!Number.isFinite(num) || num < 0) return undefined;
	return roundTo2(num);
}

function parseDateLike(value: unknown): string | undefined {
	if (value === undefined || value === null) return undefined;
	let str: string;
	if (value instanceof Date) {
		const hours = value.getUTCHours();
		const minutes = value.getUTCMinutes();
		const seconds = value.getUTCSeconds();
		if (hours === 0 && minutes === 0 && seconds === 0) {
			str = value.toISOString().slice(0, 10);
		} else {
			str = value.toISOString().slice(0, 10);
		}
	} else if (typeof value === "string") {
		str = value.trim().replace(/^['"]|['"]$/g, "");
	} else {
		return undefined;
	}
	if (!str) return undefined;
	const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
	if (!match) return undefined;
	const ymd = `${match[1]}-${match[2]}-${match[3]}`;
	return isValidYmdDate(ymd) ? ymd : undefined;
}
