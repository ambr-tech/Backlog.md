// [Custom] 予算管理機能の数値・日付の表示整形

import { roundTo2 } from "./schema.ts";

/**
 * 工数を `d` サフィックス付き文字列に整形。
 * - 整数なら `2d`、小数なら `2.5d` / `0.25d`
 * - `null` / `undefined` は `-`
 */
export function formatDays(value: number | null | undefined): string {
	if (value == null) return "-";
	if (!Number.isFinite(value)) return "-";
	const rounded = roundTo2(value);
	return `${rounded}d`;
}

/**
 * 差分（実績 - 見積）を符号付きで整形。両方設定済みのみ呼ぶ。
 */
export function formatDaysDiff(actual: number | null | undefined, estimated: number | null | undefined): string {
	if (actual == null || estimated == null) return "-";
	if (!Number.isFinite(actual) || !Number.isFinite(estimated)) return "-";
	const diff = roundTo2(actual - estimated);
	if (diff === 0) return "±0d";
	const sign = diff > 0 ? "+" : "";
	return `${sign}${diff}d`;
}

/**
 * 予算消化率（実績 / 見積、0-1）を整数パーセントで整形。
 * 見積が 0 または未設定なら `null`。
 */
export function computeBudgetUsageRate(
	actual: number | null | undefined,
	estimated: number | null | undefined,
): number | null {
	if (estimated == null || estimated === 0) return null;
	if (actual == null) return 0;
	return roundTo2(actual / estimated);
}

/**
 * 完了実績日の表示用整形。`-` フォールバックあり。
 */
export function formatCompletedDate(value: string | null | undefined): string {
	if (!value) return "-";
	return value;
}
