// [Custom] Labels フィルタの AND 判定のユニットテスト
import { describe, expect, test } from "bun:test";
import { matchesAllLabels } from "../../src/label-and-filter/matchesAllLabels";

describe("matchesAllLabels (AND label filtering)", () => {
	test("returns true when the task has all of the required labels", () => {
		expect(matchesAllLabels(["ui", "docs", "backend"], ["ui", "docs"])).toBe(true);
	});

	test("returns false when the task is missing one of the required labels", () => {
		expect(matchesAllLabels(["ui"], ["ui", "docs"])).toBe(false);
	});

	test("ignores label order", () => {
		expect(matchesAllLabels(["docs", "ui"], ["ui", "docs"])).toBe(true);
	});

	test("returns true when no labels are required", () => {
		expect(matchesAllLabels(["ui"], [])).toBe(true);
	});

	test("returns false when the task has no labels but labels are required", () => {
		expect(matchesAllLabels([], ["ui"])).toBe(false);
	});
});
