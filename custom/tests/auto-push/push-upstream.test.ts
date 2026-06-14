// [Custom] 自動プッシュ機能: push() の upstream 自動設定を実 git リポジトリで検証する。
// upstream 未設定の新規ブランチで `git push origin --quiet` が exit 128 になる不具合
// （fatal: The current branch X has no upstream branch）の回帰防止。
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { GitOperations } from "../../../src/git/operations";
import { createUniqueTestDir, getPlatformTimeout, safeCleanup } from "../../../src/test/test-utils";
import type { BacklogConfig } from "../../../src/types/index";

describe("GitOperations.push upstream 自動設定", () => {
	let root: string;
	let remoteDir: string;
	let workDir: string;

	beforeEach(async () => {
		root = createUniqueTestDir("auto-push-upstream");
		remoteDir = join(root, "remote.git");
		workDir = join(root, "work");
		await mkdir(remoteDir, { recursive: true });
		await mkdir(workDir, { recursive: true });
		await $`git init --bare`.cwd(remoteDir).quiet();
		await $`git init`.cwd(workDir).quiet();
		await $`git config user.email test@example.com`.cwd(workDir).quiet();
		await $`git config user.name "Test User"`.cwd(workDir).quiet();
		await $`git config commit.gpgsign false`.cwd(workDir).quiet();
		await $`git remote add origin ${remoteDir}`.cwd(workDir).quiet();
		await Bun.write(join(workDir, "README.md"), "# test\n");
		await $`git add README.md`.cwd(workDir).quiet();
		await $`git commit -m init`.cwd(workDir).quiet();
	});

	afterEach(async () => {
		await safeCleanup(root);
	});

	test(
		"upstream 未設定の新規ブランチでも push が成功し追跡が設定される",
		async () => {
			await $`git checkout -b feature/new-branch`.cwd(workDir).quiet();
			await Bun.write(join(workDir, "a.txt"), "a\n");
			await $`git add a.txt`.cwd(workDir).quiet();
			await $`git commit -m change`.cwd(workDir).quiet();

			const git = new GitOperations(workDir, {} as BacklogConfig);
			const pushed = await git.push("origin", workDir);
			expect(pushed).toBe(true);

			// upstream（追跡ブランチ）が設定されたこと
			const { stdout } = await $`git rev-parse --abbrev-ref --symbolic-full-name @{u}`.cwd(workDir).quiet();
			expect(stdout.toString().trim()).toBe("origin/feature/new-branch");
		},
		getPlatformTimeout(15000),
	);

	test(
		"upstream 設定済みブランチでも push が成功する",
		async () => {
			const git = new GitOperations(workDir, {} as BacklogConfig);
			// 初回 push で upstream を設定
			await git.push("origin", workDir);

			// 追加コミットして再 push（upstream 既設定パス）
			await Bun.write(join(workDir, "b.txt"), "b\n");
			await $`git add b.txt`.cwd(workDir).quiet();
			await $`git commit -m change2`.cwd(workDir).quiet();
			const pushed = await git.push("origin", workDir);
			expect(pushed).toBe(true);
		},
		getPlatformTimeout(15000),
	);
});
