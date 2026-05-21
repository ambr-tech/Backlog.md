// [Custom] 予算管理機能: Milestone ロールアップのテスト
import { describe, expect, test } from "bun:test";
import type { BacklogConfig, Task } from "../../../src/types/index";
import "../../src/budget/types";
import { computeBudgetRollup } from "../../src/budget/rollup";

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

const config: BacklogConfig = {
	projectName: "p",
	statuses: ["To Do", "In Progress", "Done"],
	labels: [],
	dateFormat: "yyyy-MM-dd",
};

describe("computeBudgetRollup", () => {
	test("Leaf タスクのみが集計対象 (親タスク除外)", () => {
		const tasks: Task[] = [
			baseTask({ id: "A", estimatedDays: 5, actualDays: 4, subtasks: ["A.1"] }), // parent
			baseTask({ id: "A.1", estimatedDays: 2, actualDays: 1 }),
			baseTask({ id: "B", estimatedDays: 3, actualDays: 2 }),
		];
		const rollup = computeBudgetRollup(tasks, config);
		expect(rollup.totalEstimatedDays).toBe(5); // A.1 + B
		expect(rollup.totalActualDays).toBe(3);
	});

	test("estimatedDays 未入力タスクは unestimatedTaskCount に計上", () => {
		const tasks: Task[] = [
			baseTask({ id: "A", estimatedDays: 2 }),
			baseTask({ id: "B" }),
			baseTask({ id: "C" }),
		];
		const rollup = computeBudgetRollup(tasks, config);
		expect(rollup.totalEstimatedDays).toBe(2);
		expect(rollup.unestimatedTaskCount).toBe(2);
	});

	test("Done かつ actualDays 未入力タスクは doneWithoutActualCount に計上", () => {
		const tasks: Task[] = [
			baseTask({ id: "A", status: "Done", estimatedDays: 1 }),
			baseTask({ id: "B", status: "Done", actualDays: 1 }),
			baseTask({ id: "C", status: "To Do" }),
		];
		const rollup = computeBudgetRollup(tasks, config);
		expect(rollup.doneWithoutActualCount).toBe(1); // A only
	});

	test("浮動小数の合計が 2 桁で丸められる", () => {
		const tasks: Task[] = [baseTask({ estimatedDays: 0.1 }), baseTask({ estimatedDays: 0.2 })];
		const rollup = computeBudgetRollup(tasks, config);
		expect(rollup.totalEstimatedDays).toBe(0.3);
	});

	test("集計対象 0 件時の挙動", () => {
		const rollup = computeBudgetRollup([], config);
		expect(rollup.totalEstimatedDays).toBeUndefined();
		expect(rollup.totalActualDays).toBeUndefined();
		expect(rollup.unestimatedTaskCount).toBe(0);
		expect(rollup.doneWithoutActualCount).toBe(0);
	});

	test("completedStatuses=['Done','Cancelled'] で Cancelled も完了扱い", () => {
		const tasks: Task[] = [baseTask({ status: "Cancelled" })];
		const cfg: BacklogConfig = {
			...config,
			statuses: ["To Do", "Done", "Cancelled"],
			completedStatuses: ["Done", "Cancelled"],
		};
		const rollup = computeBudgetRollup(tasks, cfg);
		expect(rollup.doneWithoutActualCount).toBe(1);
	});
});
