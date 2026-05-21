// [Custom] 予算管理機能: 入力適用ヘルパのテスト
import { describe, expect, test } from "bun:test";
import type { Task } from "../../../src/types/index";
import "../../src/budget/types";
import { applyBudgetCreateInput, applyBudgetUpdateInput } from "../../src/budget/apply-input";

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

describe("applyBudgetCreateInput", () => {
	test("値を Task に適用", () => {
		const task = baseTask();
		applyBudgetCreateInput(task, { title: "t", estimatedDays: 2.5, actualDays: 1, completedDate: "2026-05-21" });
		expect(task.estimatedDays).toBe(2.5);
		expect(task.actualDays).toBe(1);
		expect(task.completedDate).toBe("2026-05-21");
	});
	test("不正値で例外", () => {
		expect(() => applyBudgetCreateInput(baseTask(), { title: "t", estimatedDays: -1 })).toThrow();
		expect(() => applyBudgetCreateInput(baseTask(), { title: "t", completedDate: "2026-13-01" })).toThrow();
	});
});

describe("applyBudgetUpdateInput", () => {
	test("値を変更 (mutated: true)", () => {
		const task = baseTask({ estimatedDays: 1 });
		const result = applyBudgetUpdateInput(task, { estimatedDays: 2 });
		expect(result.mutated).toBe(true);
		expect(task.estimatedDays).toBe(2);
	});
	test("null でクリア", () => {
		const task = baseTask({ estimatedDays: 1, actualDays: 1, completedDate: "2026-01-01" });
		const result = applyBudgetUpdateInput(task, { estimatedDays: null, actualDays: null, completedDate: null });
		expect(result.mutated).toBe(true);
		expect(task.estimatedDays).toBeUndefined();
		expect(task.actualDays).toBeUndefined();
		expect(task.completedDate).toBeUndefined();
	});
	test("undefined は変更なし", () => {
		const task = baseTask({ estimatedDays: 1 });
		const result = applyBudgetUpdateInput(task, {});
		expect(result.mutated).toBe(false);
		expect(task.estimatedDays).toBe(1);
	});
	test("同じ値なら mutated: false", () => {
		const task = baseTask({ estimatedDays: 2 });
		const result = applyBudgetUpdateInput(task, { estimatedDays: 2 });
		expect(result.mutated).toBe(false);
	});
});
