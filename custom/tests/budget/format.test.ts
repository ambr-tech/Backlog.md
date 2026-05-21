// [Custom] 予算管理機能: 表示整形のユニットテスト
import { describe, expect, test } from "bun:test";
import { computeBudgetUsageRate, formatCompletedDate, formatDays, formatDaysDiff } from "../../src/budget/format";

describe("formatDays", () => {
	test.each([
		[2, "2d"],
		[2.5, "2.5d"],
		[0.25, "0.25d"],
		[0, "0d"],
	])("formatDays(%p) === %p", (input, expected) => {
		expect(formatDays(input)).toBe(expected);
	});
	test("null / undefined は '-'", () => {
		expect(formatDays(null)).toBe("-");
		expect(formatDays(undefined)).toBe("-");
	});
});

describe("formatDaysDiff", () => {
	test("差分が 0 は ±0d", () => {
		expect(formatDaysDiff(2, 2)).toBe("±0d");
	});
	test("前倒し (負) は - 付き", () => {
		expect(formatDaysDiff(1, 2)).toBe("-1d");
	});
	test("超過 (正) は + 付き", () => {
		expect(formatDaysDiff(3, 2)).toBe("+1d");
	});
	test("どちらか未設定は '-'", () => {
		expect(formatDaysDiff(null, 2)).toBe("-");
		expect(formatDaysDiff(2, null)).toBe("-");
	});
});

describe("computeBudgetUsageRate", () => {
	test("通常ケース", () => {
		expect(computeBudgetUsageRate(5, 10)).toBe(0.5);
	});
	test("見積 0 / 未設定は null", () => {
		expect(computeBudgetUsageRate(5, 0)).toBeNull();
		expect(computeBudgetUsageRate(5, undefined)).toBeNull();
	});
	test("actual 未設定は 0", () => {
		expect(computeBudgetUsageRate(undefined, 10)).toBe(0);
	});
});

describe("formatCompletedDate", () => {
	test("値があればそのまま", () => {
		expect(formatCompletedDate("2026-05-21")).toBe("2026-05-21");
	});
	test("null / 未設定は '-'", () => {
		expect(formatCompletedDate(null)).toBe("-");
		expect(formatCompletedDate(undefined)).toBe("-");
	});
});
