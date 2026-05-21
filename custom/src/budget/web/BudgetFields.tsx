// [Custom] 予算管理機能: タスク編集モーダルの 3 フィールド入力
import React, { useEffect, useState } from "react";
import type { Task } from "../../../../src/types/index.ts";
import "../types.ts";

export interface BudgetFieldValues {
	estimatedDays: number | null;
	actualDays: number | null;
	completedDate: string | null;
}

interface Props {
	task?: Task;
	disabled?: boolean;
	onChange: (updates: Partial<BudgetFieldValues>) => void;
}

function parseDaysInput(value: string): number | null {
	const trimmed = value.trim();
	if (!trimmed) return null;
	const num = Number(trimmed);
	if (!Number.isFinite(num) || num < 0) return null;
	return Math.round(num * 100) / 100;
}

function toInputValue(value: number | null | undefined): string {
	if (value == null) return "";
	return String(value);
}

function toDateInputValue(value: string | null | undefined): string {
	return value ?? "";
}

export const BudgetFields: React.FC<Props> = ({ task, disabled, onChange }) => {
	const [estimated, setEstimated] = useState<string>(toInputValue(task?.estimatedDays));
	const [actual, setActual] = useState<string>(toInputValue(task?.actualDays));
	const [completed, setCompleted] = useState<string>(toDateInputValue(task?.completedDate));

	useEffect(() => {
		setEstimated(toInputValue(task?.estimatedDays));
		setActual(toInputValue(task?.actualDays));
		setCompleted(toDateInputValue(task?.completedDate));
	}, [task?.estimatedDays, task?.actualDays, task?.completedDate]);

	const commitEstimated = () => {
		const next = estimated.trim() === "" ? null : parseDaysInput(estimated);
		if (next === undefined) return;
		onChange({ estimatedDays: next });
	};
	const commitActual = () => {
		const next = actual.trim() === "" ? null : parseDaysInput(actual);
		if (next === undefined) return;
		onChange({ actualDays: next });
	};
	const commitCompleted = () => {
		const trimmed = completed.trim();
		onChange({ completedDate: trimmed.length === 0 ? null : trimmed });
	};

	const inputBase =
		"w-full h-10 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 focus:border-transparent transition-colors duration-200";
	const disabledClass = disabled ? "opacity-60 cursor-not-allowed" : "";

	return (
		<div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
			<h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 tracking-tight mb-3">予算管理</h3>
			<div className="grid grid-cols-1 gap-3">
				<label className="block">
					<span className="block text-xs text-gray-500 dark:text-gray-400 mb-1">見積工数 (日)</span>
					<input
						type="number"
						step="0.01"
						min="0"
						className={`${inputBase} ${disabledClass}`}
						value={estimated}
						onChange={(e) => setEstimated(e.target.value)}
						onBlur={commitEstimated}
						disabled={disabled}
					/>
				</label>
				<label className="block">
					<span className="block text-xs text-gray-500 dark:text-gray-400 mb-1">実績工数 (日)</span>
					<input
						type="number"
						step="0.01"
						min="0"
						className={`${inputBase} ${disabledClass}`}
						value={actual}
						onChange={(e) => setActual(e.target.value)}
						onBlur={commitActual}
						disabled={disabled}
					/>
				</label>
				<label className="block">
					<span className="block text-xs text-gray-500 dark:text-gray-400 mb-1">完了実績日</span>
					<input
						type="date"
						className={`${inputBase} ${disabledClass}`}
						value={completed}
						onChange={(e) => setCompleted(e.target.value)}
						onBlur={commitCompleted}
						disabled={disabled}
					/>
				</label>
			</div>
		</div>
	);
};

export default BudgetFields;
