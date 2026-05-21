// [Custom] 予算管理機能の MCP tool 入力スキーマ断片

import type { JsonSchema } from "../../../../src/mcp/validation/validators.ts";

/**
 * task_create 用の追加プロパティ。
 */
export const budgetCreateSchemaProperties: Record<string, JsonSchema> = {
	estimatedDays: {
		type: "number",
		minimum: 0,
		description: "見積工数（日、小数2桁まで）。",
	},
	actualDays: {
		type: "number",
		minimum: 0,
		description: "実績工数（日、小数2桁まで）。",
	},
	completedDate: {
		type: "string",
		description: "完了実績日（YYYY-MM-DD）。",
	},
};

/**
 * task_edit 用の追加プロパティ。null を許可（=クリア、validator で null は通過する）。
 */
export const budgetEditSchemaProperties: Record<string, JsonSchema> = {
	estimatedDays: {
		type: "number",
		minimum: 0,
		description: "見積工数（日、小数2桁まで）。null でクリア。",
	},
	actualDays: {
		type: "number",
		minimum: 0,
		description: "実績工数（日、小数2桁まで）。null でクリア。",
	},
	completedDate: {
		type: "string",
		description: "完了実績日（YYYY-MM-DD）。null でクリア。",
	},
};

export interface BudgetCreateMcpArgs {
	estimatedDays?: number;
	actualDays?: number;
	completedDate?: string;
}

export interface BudgetEditMcpArgs {
	estimatedDays?: number | null;
	actualDays?: number | null;
	completedDate?: string | null;
}
