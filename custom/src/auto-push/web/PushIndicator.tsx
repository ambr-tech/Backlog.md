// [Custom] 自動プッシュ機能: ヘッダー「powered by Backlog.md」の横に併記するインジケータ。
// プッシュ中はスピナー付きで「プッシュ中...」、失敗時は短時間「プッシュ失敗」を表示する。

import React from "react";
import { usePushStatus } from "./usePushStatus";

export const PushIndicator: React.FC = () => {
	const state = usePushStatus();

	if (state === "idle") return null;

	if (state === "failed") {
		return (
			<span
				className="text-sm text-red-600 dark:text-red-400 inline-flex items-center gap-1 transition-colors duration-200"
				role="status"
				data-testid="push-indicator-failed"
			>
				<svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
					<path
						fillRule="evenodd"
						d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
						clipRule="evenodd"
					/>
				</svg>
				プッシュ失敗
			</span>
		);
	}

	return (
		<span
			className="text-sm text-amber-600 dark:text-amber-400 inline-flex items-center gap-1 transition-colors duration-200"
			role="status"
			data-testid="push-indicator"
		>
			<svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
				<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
				<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
			</svg>
			プッシュ中...
		</span>
	);
};

export default PushIndicator;
