// [Custom] タスク詳細 URL の組み立て・解析を行う純関数群

// `/`, `?`, `#` を含まない 1 セグメントを taskId として抽出する。
// プロジェクト毎にプレフィックスが異なる (`task-`, `BACK-` 等) ため、形式は限定しない。
const TASK_PATH_PATTERN = /^\/tasks\/([^/?#]+)\/?$/;

export function parseTaskPath(pathname: string): string | null {
	const match = pathname.match(TASK_PATH_PATTERN);
	return match?.[1] ?? null;
}

export function buildTaskPath(taskId: string, search = ""): string {
	const normalizedSearch = search && !search.startsWith("?") ? `?${search}` : search;
	return `/tasks/${taskId}${normalizedSearch}`;
}

export function isTaskPath(pathname: string): boolean {
	return TASK_PATH_PATTERN.test(pathname);
}
