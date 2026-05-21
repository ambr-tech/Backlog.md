// [Custom] 予算管理機能: completedDate 自動セットのテスト
import { describe, expect, test } from "bun:test";
import type { BacklogConfig, Task } from "../../../src/types/index";
import "../../src/budget/types";
import { applyCompletedDateOnCreate, applyCompletedDateOnTransition } from "../../src/budget/auto-complete-date";

const fixedDate = new Date(2026, 4, 21);
const todayYmd = "2026-05-21";

const baseTask = (overrides: Partial<Task> = {}): Task => ({
	id: "TASK-1",
	title: "t",
	status: "To Do",
	assignee: [],
	createdDate: "2026-05-01",
	labels: [],
	dependencies: [],
	...overrides,
});

const baseConfig = (overrides: Partial<BacklogConfig> = {}): BacklogConfig => ({
	projectName: "p",
	statuses: ["To Do", "In Progress", "Done"],
	labels: [],
	dateFormat: "yyyy-MM-dd",
	...overrides,
});

describe("applyCompletedDateOnTransition", () => {
	test("To Do -> Done で completedDate がセットされる (fallback)", () => {
		const prev = baseTask({ status: "To Do" });
		const next = baseTask({ status: "Done" });
		applyCompletedDateOnTransition(prev, next, baseConfig(), fixedDate);
		expect(next.completedDate).toBe(todayYmd);
	});

	test("既に completedDate がある場合は上書きしない", () => {
		const prev = baseTask({ status: "To Do" });
		const next = baseTask({ status: "Done", completedDate: "2025-12-01" });
		applyCompletedDateOnTransition(prev, next, baseConfig(), fixedDate);
		expect(next.completedDate).toBe("2025-12-01");
	});

	test("Done -> To Do では completedDate を保持", () => {
		const prev = baseTask({ status: "Done", completedDate: "2026-01-15" });
		const next = baseTask({ status: "To Do", completedDate: "2026-01-15" });
		applyCompletedDateOnTransition(prev, next, baseConfig(), fixedDate);
		expect(next.completedDate).toBe("2026-01-15");
	});

	test("Done 状態維持 (statusChange なし) では発火しない", () => {
		const prev = baseTask({ status: "Done", completedDate: "2026-01-15" });
		const next = baseTask({ status: "Done", completedDate: "2026-01-15" });
		applyCompletedDateOnTransition(prev, next, baseConfig(), fixedDate);
		expect(next.completedDate).toBe("2026-01-15");
	});

	test("completedStatuses=['Done','Cancelled'] で Cancelled 遷移時も発火", () => {
		const prev = baseTask({ status: "In Progress" });
		const next = baseTask({ status: "Cancelled" });
		applyCompletedDateOnTransition(
			prev,
			next,
			baseConfig({ statuses: ["To Do", "In Progress", "Done", "Cancelled"], completedStatuses: ["Done", "Cancelled"] }),
			fixedDate,
		);
		expect(next.completedDate).toBe(todayYmd);
	});

	test("completedStatuses 未設定時は statuses 末尾遷移で発火", () => {
		const prev = baseTask({ status: "In Progress" });
		const next = baseTask({ status: "Done" });
		applyCompletedDateOnTransition(prev, next, baseConfig(), fixedDate);
		expect(next.completedDate).toBe(todayYmd);
	});
});

describe("applyCompletedDateOnCreate", () => {
	test("新規作成時に完了状態なら自動セット", () => {
		const task = baseTask({ status: "Done" });
		applyCompletedDateOnCreate(task, baseConfig(), fixedDate);
		expect(task.completedDate).toBe(todayYmd);
	});

	test("非完了状態では自動セットしない", () => {
		const task = baseTask({ status: "To Do" });
		applyCompletedDateOnCreate(task, baseConfig(), fixedDate);
		expect(task.completedDate).toBeUndefined();
	});

	test("既に completedDate がある場合は上書きしない", () => {
		const task = baseTask({ status: "Done", completedDate: "2025-12-31" });
		applyCompletedDateOnCreate(task, baseConfig(), fixedDate);
		expect(task.completedDate).toBe("2025-12-31");
	});
});
