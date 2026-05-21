// [Custom] 予算管理機能: Milestone カードの予算プログレスバー
import React from "react";
import type { MilestoneBucket } from "../../../../src/types/index.ts";
import "../types.ts";
import { computeBudgetUsageRate, formatDays } from "../format.ts";

interface Props {
	bucket: MilestoneBucket;
}

function pickColorClass(rate: number | null): string {
	if (rate == null) return "bg-gray-400";
	if (rate >= 1) return "bg-red-500";
	if (rate >= 0.8) return "bg-yellow-500";
	return "bg-emerald-500";
}

export const BudgetSummary: React.FC<Props> = ({ bucket }) => {
	const estimated = bucket.totalEstimatedDays;
	const actual = bucket.totalActualDays;
	const unestimated = bucket.unestimatedTaskCount ?? 0;
	const doneWithoutActual = bucket.doneWithoutActualCount ?? 0;

	if (estimated === undefined && actual === undefined && unestimated === 0 && doneWithoutActual === 0) {
		return null;
	}

	const rate = computeBudgetUsageRate(actual, estimated);
	const percent = rate == null ? null : Math.round(rate * 100);
	const widthPercent = rate == null ? 0 : Math.min(rate, 1.2) * 100;
	const barColor = pickColorClass(rate);

	return (
		<div className="mt-3" data-testid="budget-summary">
			{estimated !== undefined ? (
				<>
					<div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300 mb-1">
						<span>Budget</span>
						<span>
							{formatDays(actual)} / {formatDays(estimated)}
							{percent != null ? ` (${percent}%)` : ""}
						</span>
					</div>
					<div className="w-full h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
						<div className={`h-full ${barColor} transition-all duration-300`} style={{ width: `${widthPercent}%` }} />
					</div>
				</>
			) : (
				<div className="text-xs text-gray-500 dark:text-gray-400">予算未設定</div>
			)}
			{(unestimated > 0 || doneWithoutActual > 0) && (
				<div className="mt-2 flex flex-wrap gap-2 text-xs">
					{unestimated > 0 && (
						<span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200">
							未見積 {unestimated}件
						</span>
					)}
					{doneWithoutActual > 0 && (
						<span className="inline-flex items-center px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-200">
							実績未入力 {doneWithoutActual}件
						</span>
					)}
				</div>
			)}
		</div>
	);
};

export default BudgetSummary;
