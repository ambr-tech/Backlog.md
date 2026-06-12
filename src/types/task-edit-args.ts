export interface TaskEditArgs {
	title?: string;
	description?: string;
	status?: string;
	priority?: "high" | "medium" | "low";
	milestone?: string | null;
	labels?: string[];
	addLabels?: string[];
	removeLabels?: string[];
	assignee?: string[];
	ordinal?: number;
	dependencies?: string[];
	references?: string[];
	addReferences?: string[];
	removeReferences?: string[];
	documentation?: string[];
	addDocumentation?: string[];
	removeDocumentation?: string[];
	modifiedFiles?: string[];
	implementationPlan?: string;
	planSet?: string;
	planAppend?: string[];
	planClear?: boolean;
	implementationNotes?: string;
	notesSet?: string;
	notesAppend?: string[];
	notesClear?: boolean;
	commentsAppend?: string[];
	commentAuthor?: string;
	finalSummary?: string;
	finalSummaryAppend?: string[];
	finalSummaryClear?: boolean;
	acceptanceCriteriaSet?: string[];
	acceptanceCriteriaAdd?: string[];
	acceptanceCriteriaRemove?: number[];
	acceptanceCriteriaCheck?: number[];
	acceptanceCriteriaUncheck?: number[];
	definitionOfDoneAdd?: string[];
	definitionOfDoneRemove?: number[];
	definitionOfDoneCheck?: number[];
	definitionOfDoneUncheck?: number[];
	estimatedDays?: number | null; // [Custom] 予算管理機能: 見積工数（null でクリア）
	actualDays?: number | null; // [Custom] 予算管理機能: 実績工数（null でクリア）
	completedDate?: string | null; // [Custom] 予算管理機能: 完了実績日（null でクリア）
}

export type TaskEditRequest = TaskEditArgs & { id: string };
