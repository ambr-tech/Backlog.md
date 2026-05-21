// [Custom] 予算管理機能のバリデーション・正規化ロジック

export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 数値を 2 桁で丸める。浮動小数誤差を抑える。
 */
export function roundTo2(value: number): number {
	return Math.round(value * 100) / 100;
}

/**
 * 数値（estimatedDays / actualDays）を検証・正規化する。
 * `null` はクリアを意味し、そのまま返す。
 * `undefined` は変更なしを意味し、そのまま返す。
 */
export function normalizeDaysValue(value: unknown, field: string): number | null | undefined {
	if (value === undefined) return undefined;
	if (value === null) return null;
	if (typeof value !== "number" || !Number.isFinite(value)) {
		throw new Error(`${field} must be a finite number.`);
	}
	if (value < 0) {
		throw new Error(`${field} must be greater than or equal to 0.`);
	}
	return roundTo2(value);
}

/**
 * 日付文字列を検証する。`YYYY-MM-DD` 形式かつ実在する日付であることをチェック。
 * 未来日付は許可（警告ログのみ）。
 */
export function normalizeCompletedDateValue(value: unknown, field: string): string | null | undefined {
	if (value === undefined) return undefined;
	if (value === null) return null;
	if (typeof value !== "string") {
		throw new Error(`${field} must be a string in YYYY-MM-DD format.`);
	}
	const trimmed = value.trim();
	if (!DATE_PATTERN.test(trimmed)) {
		throw new Error(`${field} must be in YYYY-MM-DD format.`);
	}
	if (!isValidYmdDate(trimmed)) {
		throw new Error(`${field} is not a valid date: ${trimmed}`);
	}
	const todayYmd = getTodayYmd();
	if (trimmed > todayYmd && typeof console !== "undefined" && typeof console.warn === "function") {
		console.warn(`[budget] ${field} is set to a future date: ${trimmed}`);
	}
	return trimmed;
}

/**
 * `YYYY-MM-DD` 形式の文字列が実在する日付かを判定。
 */
export function isValidYmdDate(value: string): boolean {
	const match = value.match(DATE_PATTERN);
	if (!match) return false;
	const year = Number(value.slice(0, 4));
	const month = Number(value.slice(5, 7));
	const day = Number(value.slice(8, 10));
	if (month < 1 || month > 12) return false;
	if (day < 1 || day > 31) return false;
	const date = new Date(Date.UTC(year, month - 1, day));
	return (
		date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
	);
}

/**
 * 現在日付を `YYYY-MM-DD` 形式で取得。
 */
export function getTodayYmd(now: Date = new Date()): string {
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}
