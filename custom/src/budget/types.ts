// [Custom] 予算管理機能用に upstream の型を TS module augmentation で拡張する
import type {} from "../../../src/types/index.ts";

declare module "../../../src/types/index.ts" {
	interface Task {
		estimatedDays?: number;
		actualDays?: number;
		completedDate?: string;
	}

	interface MilestoneBucket {
		totalEstimatedDays?: number;
		totalActualDays?: number;
		unestimatedTaskCount?: number;
		doneWithoutActualCount?: number;
	}

	interface TaskCreateInput {
		estimatedDays?: number;
		actualDays?: number;
		completedDate?: string;
	}

	interface TaskUpdateInput {
		estimatedDays?: number | null;
		actualDays?: number | null;
		completedDate?: string | null;
	}
}
