// [Custom] タスク URL 解析・組み立てユニットテスト
import { describe, expect, test } from "bun:test";
import { buildTaskPath, isTaskPath, parseTaskPath } from "../../src/task-url-routing/taskUrlPath";

describe("parseTaskPath", () => {
	test.each([
		["/tasks/task-001", "task-001"],
		["/tasks/task-123", "task-123"],
		["/tasks/task-abc_def-1", "task-abc_def-1"],
		["/tasks/task-001/", "task-001"],
	])("parseTaskPath(%p) === %p", (input, expected) => {
		expect(parseTaskPath(input)).toBe(expected);
	});

	test.each(["/tasks", "/tasks/", "/", "/tasks/task-001/extra", "/tasks/foo-001", "/other/task-001"])(
		"parseTaskPath(%p) === null",
		(input) => {
			expect(parseTaskPath(input)).toBeNull();
		},
	);
});

describe("buildTaskPath", () => {
	test("クエリ無しは pathname のみ", () => {
		expect(buildTaskPath("task-001")).toBe("/tasks/task-001");
	});

	test("空文字のクエリも pathname のみ", () => {
		expect(buildTaskPath("task-001", "")).toBe("/tasks/task-001");
	});

	test("? 付きのクエリはそのまま付与", () => {
		expect(buildTaskPath("task-001", "?status=Active")).toBe("/tasks/task-001?status=Active");
	});

	test("? 無しのクエリには ? を補完", () => {
		expect(buildTaskPath("task-001", "status=Active&sort=date")).toBe("/tasks/task-001?status=Active&sort=date");
	});
});

describe("isTaskPath", () => {
	test("/tasks/task-001 は true", () => {
		expect(isTaskPath("/tasks/task-001")).toBe(true);
	});
	test("/tasks は false", () => {
		expect(isTaskPath("/tasks")).toBe(false);
	});
	test("/ は false", () => {
		expect(isTaskPath("/")).toBe(false);
	});
});
