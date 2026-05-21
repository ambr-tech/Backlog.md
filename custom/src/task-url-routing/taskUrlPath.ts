// [Custom] タスク詳細を URL のクエリパラメータ (?task=<id>) として表現するための純関数群。
// pathname ではなく search 文字列を扱うのは、Kanban / Milestones / All Tasks 等のベース画面を
// 維持したままモーダルを重ねるため (Routes 再評価で画面が TaskList に切り替わるのを避ける)。

const TASK_QUERY_KEY = "task";

export function parseTaskId(search: string): string | null {
	const params = new URLSearchParams(search);
	const value = params.get(TASK_QUERY_KEY);
	return value && value.length > 0 ? value : null;
}

export function buildSearchWithTaskId(search: string, taskId: string): string {
	const params = new URLSearchParams(search);
	params.set(TASK_QUERY_KEY, taskId);
	const s = params.toString();
	return s ? `?${s}` : "";
}

export function buildSearchWithoutTaskId(search: string): string {
	const params = new URLSearchParams(search);
	params.delete(TASK_QUERY_KEY);
	const s = params.toString();
	return s ? `?${s}` : "";
}

export function hasTaskId(search: string): boolean {
	return parseTaskId(search) !== null;
}
