// [Custom] 予算管理機能: frontmatter ↔ Task の往復テスト
import { describe, expect, test } from "bun:test";
import { parseTask } from "../../../src/markdown/parser";
import { serializeTask } from "../../../src/markdown/serializer";
import type { Task } from "../../../src/types/index";
import "../../src/budget/types";

const baseTask: Task = {
	id: "TASK-1",
	title: "Example",
	status: "To Do",
	assignee: [],
	createdDate: "2026-05-01",
	labels: [],
	dependencies: [],
};

describe("frontmatter <-> Task round trip", () => {
	test("estimatedDays / actualDays / completedDate を保つ", () => {
		const task: Task = {
			...baseTask,
			estimatedDays: 2.5,
			actualDays: 1.75,
			completedDate: "2026-05-21",
		};
		const serialized = serializeTask(task);
		const parsed = parseTask(serialized);
		expect(parsed.estimatedDays).toBe(2.5);
		expect(parsed.actualDays).toBe(1.75);
		expect(parsed.completedDate).toBe("2026-05-21");
	});

	test("undefined フィールドは frontmatter に出力されない", () => {
		const task: Task = { ...baseTask };
		const serialized = serializeTask(task);
		expect(serialized).not.toContain("estimated_days");
		expect(serialized).not.toContain("actual_days");
		expect(serialized).not.toContain("completed_date");
	});

	test("既存タスク (budget フィールドなし) が壊れずに読める", () => {
		const content = `---
id: TASK-99
title: Existing
status: To Do
assignee: []
created_date: 2026-01-01
labels: []
dependencies: []
---

## Description

old`;
		const parsed = parseTask(content);
		expect(parsed.id).toBe("TASK-99");
		expect(parsed.estimatedDays).toBeUndefined();
		expect(parsed.actualDays).toBeUndefined();
		expect(parsed.completedDate).toBeUndefined();
	});

	test("frontmatter に budget キーがあれば Task 型に注入", () => {
		const content = `---
id: TASK-100
title: With Budget
status: Done
assignee: []
created_date: 2026-01-01
labels: []
dependencies: []
estimated_days: 3
actual_days: 4.5
completed_date: '2026-05-15'
---

body`;
		const parsed = parseTask(content);
		expect(parsed.estimatedDays).toBe(3);
		expect(parsed.actualDays).toBe(4.5);
		expect(parsed.completedDate).toBe("2026-05-15");
	});
});
