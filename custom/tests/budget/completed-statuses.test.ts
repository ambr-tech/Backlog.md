// [Custom] 予算管理機能: 完了状態判定のテスト
import { describe, expect, test } from "bun:test";
import type { BacklogConfig } from "../../../src/types/index";
import "../../src/budget/types";
import { isCompletedStatus, resolveCompletedStatuses } from "../../src/budget/completed-statuses";

const cfg = (overrides: Partial<BacklogConfig> = {}): BacklogConfig => ({
	projectName: "p",
	statuses: ["To Do", "In Progress", "Done"],
	labels: [],
	dateFormat: "yyyy-MM-dd",
	...overrides,
});

describe("resolveCompletedStatuses", () => {
	test("completedStatuses 設定値を返す", () => {
		expect(
			resolveCompletedStatuses(
				cfg({ statuses: ["To Do", "Done", "Cancelled"], completedStatuses: ["Done", "Cancelled"] }),
			),
		).toEqual(["Done", "Cancelled"]);
	});

	test("未設定時は statuses 末尾 1 要素にフォールバック", () => {
		expect(resolveCompletedStatuses(cfg())).toEqual(["Done"]);
	});

	test("statuses に存在しない値は警告ログで無視", () => {
		expect(
			resolveCompletedStatuses(
				cfg({ statuses: ["To Do", "Done"], completedStatuses: ["Done", "InvalidStatus"] }),
			),
		).toEqual(["Done"]);
	});

	test("config が null の場合は空配列", () => {
		expect(resolveCompletedStatuses(null)).toEqual([]);
	});
});

describe("isCompletedStatus", () => {
	test("case-insensitive 一致", () => {
		expect(isCompletedStatus("done", cfg())).toBe(true);
		expect(isCompletedStatus("Done", cfg())).toBe(true);
		expect(isCompletedStatus("In Progress", cfg())).toBe(false);
	});
});
