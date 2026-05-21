// [Custom] グローバルショートカットがテキスト入力中に誤発火するのを防ぐための判定ユーティリティ

const NON_TEXT_INPUT_TYPES = new Set([
	"button",
	"submit",
	"reset",
	"checkbox",
	"radio",
	"file",
	"image",
	"range",
	"color",
]);

/**
 * イベントターゲットがテキスト入力可能要素にあるかを判定する。
 *
 * 判定対象:
 * - `<textarea>`
 * - テキスト系の `<input>` (button/checkbox/radio など非テキスト系は除外)
 * - `contenteditable="true"` 要素 (リッチエディタ等)
 */
export function isTypingInTextField(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	const tag = target.tagName;
	if (tag === "TEXTAREA") return true;
	if (tag === "INPUT") {
		const type = (target as HTMLInputElement).type.toLowerCase();
		return !NON_TEXT_INPUT_TYPES.has(type);
	}
	return target.isContentEditable;
}
