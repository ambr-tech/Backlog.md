// [Custom] 完了状態 (completedStatuses) を判定するためのヘルパ

import type { BacklogConfig } from "../../../src/types/index.ts";
import "./types.ts";

/**
 * 設定値から「完了として扱うステータス集合」を解決する。
 * - `completedStatuses` が設定されていればそれを採用。
 * - 未設定なら `statuses` 配列の末尾 1 要素にフォールバック。
 * - 両方なければ空配列。
 */
export function resolveCompletedStatuses(config: BacklogConfig | null | undefined): string[] {
	if (!config) return [];
	const configured = config.completedStatuses;
	if (Array.isArray(configured) && configured.length > 0) {
		const allowed = Array.isArray(config.statuses) ? new Set(config.statuses.map((s) => s.trim())) : null;
		const filtered: string[] = [];
		for (const status of configured) {
			const trimmed = String(status ?? "").trim();
			if (!trimmed) continue;
			if (allowed && !allowed.has(trimmed)) {
				if (typeof console !== "undefined" && typeof console.warn === "function") {
					console.warn(`[budget] completedStatuses contains unknown status: ${trimmed} (ignored)`);
				}
				continue;
			}
			filtered.push(trimmed);
		}
		if (filtered.length > 0) {
			return filtered;
		}
	}
	if (Array.isArray(config.statuses) && config.statuses.length > 0) {
		const last = config.statuses[config.statuses.length - 1];
		if (typeof last === "string" && last.trim().length > 0) {
			return [last.trim()];
		}
	}
	return [];
}

/**
 * 指定ステータスが「完了」とみなされるかを判定。
 */
export function isCompletedStatus(status: string | undefined | null, config: BacklogConfig | null | undefined): boolean {
	const target = (status ?? "").trim().toLowerCase();
	if (!target) return false;
	const list = resolveCompletedStatuses(config);
	return list.some((s) => s.toLowerCase() === target);
}
