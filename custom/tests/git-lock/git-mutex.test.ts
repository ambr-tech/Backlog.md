// [Custom] git操作の直列化: ミューテックスのテスト
import { describe, expect, test } from "bun:test";
import { runGitExclusive } from "../../src/git-lock/git-mutex";

describe("runGitExclusive", () => {
	test("並行投入したタスクが重ならず直列に実行される", async () => {
		const events: string[] = [];
		let active = 0;
		const task = (tag: string) =>
			runGitExclusive(async () => {
				active++;
				expect(active).toBe(1); // 同時に走るのは常に 1 つ
				events.push(`${tag}:start`);
				await new Promise((r) => setTimeout(r, 10));
				events.push(`${tag}:end`);
				active--;
			});

		// 同時に投入しても直列化されるため start/end が交互に入れ子にならない
		await Promise.all([task("a"), task("b"), task("c")]);
		expect(events).toEqual(["a:start", "a:end", "b:start", "b:end", "c:start", "c:end"]);
	});

	test("1 つが reject しても後続は実行される", async () => {
		const order: string[] = [];
		const p1 = runGitExclusive(async () => {
			order.push("p1");
			throw new Error("boom");
		});
		const p2 = runGitExclusive(async () => {
			order.push("p2");
			return "ok";
		});

		await expect(p1).rejects.toThrow("boom");
		await expect(p2).resolves.toBe("ok");
		expect(order).toEqual(["p1", "p2"]);
	});

	test("戻り値が呼び出し側へ伝わる", async () => {
		const result = await runGitExclusive(async () => 42);
		expect(result).toBe(42);
	});
});
