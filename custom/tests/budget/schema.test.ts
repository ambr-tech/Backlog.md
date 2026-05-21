// [Custom] 予算管理機能: バリデーション schema のユニットテスト
import { describe, expect, test } from "bun:test";
import {
	getTodayYmd,
	isValidYmdDate,
	normalizeCompletedDateValue,
	normalizeDaysValue,
	roundTo2,
} from "../../src/budget/schema";

describe("normalizeDaysValue", () => {
	test("`undefined` は undefined を返す", () => {
		expect(normalizeDaysValue(undefined, "estimatedDays")).toBeUndefined();
	});
	test("`null` は null を返す", () => {
		expect(normalizeDaysValue(null, "estimatedDays")).toBeNull();
	});
	test("0 を許可", () => {
		expect(normalizeDaysValue(0, "estimatedDays")).toBe(0);
	});
	test("0.25, 2.5, 100 が通る", () => {
		expect(normalizeDaysValue(0.25, "x")).toBe(0.25);
		expect(normalizeDaysValue(2.5, "x")).toBe(2.5);
		expect(normalizeDaysValue(100, "x")).toBe(100);
	});
	test("小数3桁以上は2桁に丸める", () => {
		expect(normalizeDaysValue(1.234, "x")).toBe(1.23);
		expect(normalizeDaysValue(1.235, "x")).toBe(1.24);
	});
	test("負値は reject", () => {
		expect(() => normalizeDaysValue(-0.01, "x")).toThrow();
	});
	test("NaN / Infinity / 非数値は reject", () => {
		expect(() => normalizeDaysValue(Number.NaN, "x")).toThrow();
		expect(() => normalizeDaysValue(Number.POSITIVE_INFINITY, "x")).toThrow();
		expect(() => normalizeDaysValue("abc", "x")).toThrow();
	});
});

describe("normalizeCompletedDateValue", () => {
	test("正しい YYYY-MM-DD を通す", () => {
		expect(normalizeCompletedDateValue("2026-05-21", "completedDate")).toBe("2026-05-21");
	});
	test("null は null を返す", () => {
		expect(normalizeCompletedDateValue(null, "completedDate")).toBeNull();
	});
	test("undefined は undefined", () => {
		expect(normalizeCompletedDateValue(undefined, "completedDate")).toBeUndefined();
	});
	test("不正な日付 (2026-02-30) は reject", () => {
		expect(() => normalizeCompletedDateValue("2026-02-30", "completedDate")).toThrow();
	});
	test("フォーマット不正は reject", () => {
		expect(() => normalizeCompletedDateValue("2026/05/21", "completedDate")).toThrow();
		expect(() => normalizeCompletedDateValue("21-05-2026", "completedDate")).toThrow();
	});
	test("未来日付は警告のみで通過", () => {
		const future = "2099-12-31";
		expect(normalizeCompletedDateValue(future, "completedDate")).toBe(future);
	});
});

describe("isValidYmdDate", () => {
	test("有効", () => {
		expect(isValidYmdDate("2024-02-29")).toBe(true); // 閏年
		expect(isValidYmdDate("2026-01-01")).toBe(true);
	});
	test("無効", () => {
		expect(isValidYmdDate("2025-02-29")).toBe(false); // 平年
		expect(isValidYmdDate("2026-13-01")).toBe(false);
		expect(isValidYmdDate("2026-02-30")).toBe(false);
	});
});

describe("roundTo2 / getTodayYmd", () => {
	test("roundTo2 は浮動小数誤差を抑える", () => {
		expect(roundTo2(0.1 + 0.2)).toBe(0.3);
	});
	test("getTodayYmd は YYYY-MM-DD 形式", () => {
		expect(getTodayYmd(new Date(2026, 4, 21))).toBe("2026-05-21");
	});
});
