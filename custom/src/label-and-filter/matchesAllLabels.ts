// [Custom] Labels フィルタの AND 判定（MCP の Labels フィルタと挙動を統一するための共通ロジック）

/**
 * タスクが指定された全ラベルを持つか（AND 判定）。
 *
 * 両引数とも小文字へ正規化済みであることを前提とする。
 */
export function matchesAllLabels(taskLabelsLower: string[], requiredLabelsLower: string[]): boolean {
	if (requiredLabelsLower.length === 0) {
		return true;
	}
	if (!taskLabelsLower || taskLabelsLower.length === 0) {
		return false;
	}
	const taskLabelSet = new Set(taskLabelsLower);
	return requiredLabelsLower.every((label) => taskLabelSet.has(label));
}
