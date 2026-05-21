// [Custom] タスク URL (クエリパラメータ駆動) ユニットテスト
import { describe, expect, test } from "bun:test";
import {
	buildSearchWithTaskId,
	buildSearchWithoutTaskId,
	hasTaskId,
	parseTaskId,
} from "../../src/task-url-routing/taskUrlPath";

describe("parseTaskId", () => {
	test.each([
		["?task=BACK-222", "BACK-222"],
		["?task=task-001", "task-001"],
		["?task=PROJ-1", "PROJ-1"],
		["?task=123", "123"],
		["?status=Active&task=BACK-222", "BACK-222"],
		["?task=BACK-222&status=Active", "BACK-222"],
	])("parseTaskId(%p) === %p", (input, expected) => {
		expect(parseTaskId(input)).toBe(expected);
	});

	test.each(["", "?", "?status=Active", "?task=", "?other=BACK-222"])(
		"parseTaskId(%p) === null",
		(input) => {
			expect(parseTaskId(input)).toBeNull();
		},
	);
});

describe("buildSearchWithTaskId", () => {
	test("空 search に task を追加", () => {
		expect(buildSearchWithTaskId("", "BACK-222")).toBe("?task=BACK-222");
	});

	test("既存 search に task を追加 (他キー維持)", () => {
		expect(buildSearchWithTaskId("?status=Active", "BACK-222")).toBe("?status=Active&task=BACK-222");
	});

	test("既存 task を上書き", () => {
		expect(buildSearchWithTaskId("?task=OLD-1", "NEW-2")).toBe("?task=NEW-2");
	});

	test("既存 task と他キーがある場合、task のみ上書き", () => {
		expect(buildSearchWithTaskId("?status=A&task=OLD-1", "NEW-2")).toBe("?status=A&task=NEW-2");
	});

	test("? なし入力でも動作する", () => {
		expect(buildSearchWithTaskId("status=Active", "BACK-222")).toBe("?status=Active&task=BACK-222");
	});
});

describe("buildSearchWithoutTaskId", () => {
	test("task のみの search → 空文字", () => {
		expect(buildSearchWithoutTaskId("?task=BACK-222")).toBe("");
	});

	test("task + 他キー → 他キーのみ残る", () => {
		expect(buildSearchWithoutTaskId("?status=Active&task=BACK-222")).toBe("?status=Active");
	});

	test("task なし → そのまま", () => {
		expect(buildSearchWithoutTaskId("?status=Active")).toBe("?status=Active");
	});

	test("空 search → 空文字", () => {
		expect(buildSearchWithoutTaskId("")).toBe("");
	});
});

describe("hasTaskId", () => {
	test("task パラメータあり → true", () => {
		expect(hasTaskId("?task=BACK-222")).toBe(true);
	});

	test("task と他キー混在 → true", () => {
		expect(hasTaskId("?status=A&task=BACK-222")).toBe(true);
	});

	test("空文字 → false", () => {
		expect(hasTaskId("")).toBe(false);
	});

	test("他キーのみ → false", () => {
		expect(hasTaskId("?status=Active")).toBe(false);
	});

	test("task キーだけあって値が空 → false", () => {
		expect(hasTaskId("?task=")).toBe(false);
	});
});
