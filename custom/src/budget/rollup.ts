// [Custom] Milestone への予算ロールアップ集計（Active かつ Leaf のみ）

import type { BacklogConfig, MilestoneBucket, Task } from "../../../src/types/index.ts";
import "./types.ts";
import { isCompletedStatus } from "./completed-statuses.ts";
import { roundTo2 } from "./schema.ts";

interface BudgetRollupResult {
	totalEstimatedDays?: number;
	totalActualDays?: number;
	unestimatedTaskCount: number;
	doneWithoutActualCount: number;
}

/**
 * 単一の Milestone に属するタスク群から予算集計値を計算する。
 * Archive されたタスク、親タスク（subtasks 非空）は除外。
 */
export function computeBudgetRollup(
	tasks: Task[],
	config: BacklogConfig | null | undefined,
): BudgetRollupResult {
	const target = tasks.filter(isRollupTarget);

	let estimatedSum = 0;
	let estimatedCount = 0;
	let actualSum = 0;
	let actualCount = 0;
	let unestimatedTaskCount = 0;
	let doneWithoutActualCount = 0;

	for (const task of target) {
		if (typeof task.estimatedDays === "number" && Number.isFinite(task.estimatedDays)) {
			estimatedSum += task.estimatedDays;
			estimatedCount += 1;
		} else {
			unestimatedTaskCount += 1;
		}
		if (typeof task.actualDays === "number" && Number.isFinite(task.actualDays)) {
			actualSum += task.actualDays;
			actualCount += 1;
		}
		if (isCompletedStatus(task.status, config)) {
			if (!(typeof task.actualDays === "number" && Number.isFinite(task.actualDays))) {
				doneWithoutActualCount += 1;
			}
		}
	}

	const result: BudgetRollupResult = {
		unestimatedTaskCount,
		doneWithoutActualCount,
	};
	if (estimatedCount > 0) {
		result.totalEstimatedDays = roundTo2(estimatedSum);
	}
	if (actualCount > 0) {
		result.totalActualDays = roundTo2(actualSum);
	}
	return result;
}

/**
 * MilestoneBucket に集計値を直接書き込むヘルパ。
 * upstream の buildMilestoneBuckets / buildMilestoneSummary の結果に対して 1 行で適用する想定。
 */
export function applyBudgetRollup(bucket: MilestoneBucket, config: BacklogConfig | null | undefined): MilestoneBucket {
	if (bucket.isNoMilestone) {
		// 「milestone なし」バケットは集計対象外（仕様: Milestone 紐付けがあるタスクのみ）
		bucket.totalEstimatedDays = undefined;
		bucket.totalActualDays = undefined;
		bucket.unestimatedTaskCount = 0;
		bucket.doneWithoutActualCount = 0;
		return bucket;
	}
	const rollup = computeBudgetRollup(bucket.tasks, config);
	bucket.totalEstimatedDays = rollup.totalEstimatedDays;
	bucket.totalActualDays = rollup.totalActualDays;
	bucket.unestimatedTaskCount = rollup.unestimatedTaskCount;
	bucket.doneWithoutActualCount = rollup.doneWithoutActualCount;
	return bucket;
}

/**
 * バケット配列全体に rollup を適用。
 */
export function applyBudgetRollupAll(
	buckets: MilestoneBucket[],
	config: BacklogConfig | null | undefined,
): MilestoneBucket[] {
	for (const bucket of buckets) {
		applyBudgetRollup(bucket, config);
	}
	return buckets;
}

function isRollupTarget(task: Task): boolean {
	if (task.source === "completed") {
		// completed フォルダ内のタスクは local-editable 扱い。集計対象に含める。
	}
	if (Array.isArray(task.subtasks) && task.subtasks.length > 0) {
		return false;
	}
	return true;
}
