# 予算管理機能 実装レビュー

- 対象コミット: `3aa47d6 [Custom] 予算管理機能 (Budget Management) を追加`
- ブランチ: `feature/budget-management`
- レビュー基準: [`custom/spec/spec_budget_management.md`](../spec_budget_management.md)・[`FORK_NOTES.md`](../../../FORK_NOTES.md)
- レビュー日: 2026-05-21

---

## 1. サマリ

- 新規ファイル 18 件 / 既存ファイル 19 件 / 計 +1,415 行 / -12 行。
- 実体は `custom/src/budget/` 配下に集約、upstream 変更は委譲呼び出し中心で FORK_NOTES の方針に沿う。
- `bun test custom/tests/budget/` の 61 ケースは全て pass、`tsc --noEmit` もエラーなし。
- 一方で spec の必須スコープのうち **CLI / TUI / Milestone 詳細テーブル / ソート / MCP edit の `null` クリア** が未実装。コミットメッセージでは「スコープ外」と書かれているが、仕様書 §1.2 ではこれらはスコープ内。実装は **Core + Web UI 表示 + MCP 出力 + 一部 MCP 入力** までの範囲に留まっている。

総評: **Core 層は完成度が高く即マージ可能水準。サーフェス層は spec 範囲を意図的に縮小しており、追加 PR / 追加コミットで補完が必要**。

---

## 2. FORK_NOTES 適合性

| FORK_NOTES ルール | 評価 | 備考 |
|------------------|------|------|
| 新規ファイルは `custom/` 配下 | ✅ | 18 件すべて `custom/src/budget/` または `custom/tests/budget/` 配下 |
| コミットメッセージ先頭に `[Custom]` | ✅ | `[Custom] 予算管理機能 (Budget Management) を追加` |
| ブランチ名 `feature/` プレフィックス | ✅ | `feature/budget-management` |
| 言語ルール（コメント・ドキュメント日本語） | ✅ | 全ファイル日本語コメント、識別子は英語 |
| 既存ファイル変更は最小行 + マーカー | ✅ | 1 ファイルあたり最大でも数行、すべて `// [Custom] ...` または `// [Custom:start] ... // [Custom:end]` |
| 実装本体を `custom/` 配下に切り出し | ✅ | upstream 側は委譲呼び出しのみ |
| 1 行変更にも理由コメント | ✅ | 例: `applyBudgetRollupAll(buckets, options?.config ?? null); // [Custom] 予算管理機能の委譲呼び出し` |

> [!NOTE]
> `custom/src/budget/types.ts` の TS module augmentation で upstream の `Task` / `MilestoneBucket` / `TaskCreateInput` / `TaskUpdateInput` を拡張する設計は FORK_NOTES の「新規定義は custom 配下」の原則を最大限活かしている。**upstream 取り込み時のコンフリクトを大幅に低減する優れた設計**。

---

## 3. 仕様適合性（章ごと）

### 3.1 §3 データモデル — ✅ 適合

- `types.ts` の augmentation はスペック §3.1 の TS 宣言と完全一致。
- `src/types/index.ts:312` への `completedStatuses?: string[]` の 1 行追加もマーカー付きで spec §3.1 末尾の指示通り。
- frontmatter キー名 (`estimated_days` / `actual_days` / `completed_date`) は spec §3.2 と一致。`undefined` 時にキーごと出力しない動作はテスト (`frontmatter.test.ts:33-39`) で担保。

### 3.2 §4.1 バリデーション — ✅ 適合

- `normalizeDaysValue`: 負値・NaN・Infinity・非数値 reject、小数3桁以上は2桁丸め、`null` クリア、`undefined` 無変更 — spec 表通り。
- `normalizeCompletedDateValue`: フォーマット不正 reject、存在しない日付 reject (`2026-02-30` 含む)、未来日付は `console.warn` のみ — spec 通り。
- 閏年判定 (`2024-02-29` ✅ / `2025-02-29` ❌) もテストで確認 (`schema.test.ts:65-72`)。

### 3.3 §4.2 `completedDate` 自動セット — ✅ 適合

- `applyCompletedDateOnTransition`: `prev` 未完了 → `next` 完了かつ `completedDate` 未設定のときのみ当日値で埋める。
- `prev` 完了 → `next` 完了の遷移では発火しない (= 完了状態維持・完了内ステータス変更の両方をカバー)。
- 完了 → 非完了で `completedDate` を保持。
- `applyCompletedDateOnCreate`: 新規作成時に完了状態であれば自動セット。
- 呼び出しは `src/core/backlog.ts:1059, 1091` で、create と update の両方をフックしている。
- 日付フォーマットは `config.includeDateTimeInDates` の影響を受けない (`getTodayYmd` は時刻を含まない) — spec 通り。

### 3.4 §4.3 Milestone ロールアップ — ⚠️ 軽微な懸念

- `computeBudgetRollup` は親タスク (`subtasks` 非空) を除外、未見積・done-without-actual を計上 — spec 表通り。
- `applyBudgetRollupAll` で全バケットに適用。`isNoMilestone` バケットは集計値 `undefined` / `0` で空に。
- 浮動小数の合計 `0.1 + 0.2` が 0.3 に丸まることをテストで確認 (`rollup.test.ts:58-62`)。

**懸念 1（dead code）**: `rollup.ts:97-105` の `isRollupTarget` 内に空の `if` ブロックがある。

```ts
function isRollupTarget(task: Task): boolean {
    if (task.source === "completed") {
        // completed フォルダ内のタスクは local-editable 扱い。集計対象に含める。
    }
    // ↑ no-op
    if (Array.isArray(task.subtasks) && task.subtasks.length > 0) {
        return false;
    }
    return true;
}
```

`source === "completed"` 用の分岐が空。**Archive タスクの除外責務がここに無い**ことが少し気になる。spec §4.3 は「`backlog/archive/tasks/` 配下のタスクは除外」とあるが、現在の実装はそれを呼び出し元 (`buildMilestoneBuckets` に渡される `tasks`) に依存している。upstream 側で `archive/` タスクは取得時にすでに分離されていることが前提。

→ **修正案**: コメントのみのブロックは削除して `isRollupTarget` を簡素化、または明示的に `source === "remote"` 等の除外判定を入れる。さらに、Archive 除外の責務がどこにあるかを spec か README で明文化する。

**懸念 2**: `MilestoneBucket.isNoMilestone === true` バケットでは集計値を `undefined / 0` で初期化しているが、`bucket.tasks` を渡さず呼び出しても初期値が確実にセットされない可能性。`applyBudgetRollup` 内で `bucket.isNoMilestone` 早期 return 後に明示初期化しているため実害なし。

### 3.5 §4.4 編集不可状態 — ✅ 適合

- `BudgetFields.tsx`: `disabled` prop を `<input>` の `disabled` 属性に伝播し、視覚的にも `opacity-60 cursor-not-allowed` を付与。
- 呼び出し側 `TaskDetailsModal.tsx:1046` で `disabled={isFromOtherBranch}` を渡す。
- サーバ側で編集不可エラーパスへの乗り入れは upstream の `updateTaskFromInput` が責務を持つため独自エラーは追加されていない (spec 通り)。

---

### 3.6 §5.1 Web UI — ⚠️ 部分実装

| spec 項目 | 実装 |
|----------|------|
| §5.1.1 タスク編集モーダル 3 フィールド | ✅ `BudgetFields.tsx` で実装。配置順は spec の `dueDate 直後` ではなく `milestone select の直下`（軽微なズレ）|
| §5.1.2 Milestone カード プログレスバー | ✅ `BudgetSummary.tsx`、3 色閾値 / 未入力件数バッジ / 「予算未設定」フォールバック実装 |
| §5.1.3 Milestone 詳細ページのタスクテーブル 3 列 | ❌ **未実装**。代替として `MilestoneTaskRow.tsx` にインライン表示 (col-span-full の追加行) を追加 |
| §5.1.4 ソート (`estimatedDays`/`actualDays`/`completedDate`) | ❌ **未実装** |

`MilestoneTaskRow.tsx` のインライン表示は spec に無い追加だが、Milestone カード配下のタスクリストに見積/実績/完了日を一行で表示する形になり、UX 上は §5.1.3 の代替として機能する。ただし spec §5.1.3 にある「合計フッター行」「差分列 (`actualDays - estimatedDays`)」はない。

### 3.7 §5.2 CLI — ❌ 未実装

- `--estimated-days` / `--actual-days` / `--completed-date` フラグの追加なし。
- `task list --sort estimated-days` 等の追加なし。
- `task view` プレーン出力の追加は **実装されている** (`src/formatters/task-plain-text.ts:108-116`)。これは MCP / Web 経由で経路を再利用するため自動的に効いている。

### 3.8 §5.3 MCP — ⚠️ 部分適合

- `task_create` schema に 3 プロパティが追加 (`schema-generators.ts:135`、`budgetCreateSchemaProperties` 経由) — ✅
- `task_edit` schema にも追加 (`schema-generators.ts:383`) — ✅
- ただし spec §5.3.1 では `"type": ["number", "null"]` で **null を JSON Schema レベルで許可** することを要求。実装の `budgetEditSchemaProperties` は `{ type: "number", ... }` で **null は schema validation で reject される可能性**。
- `task_create` ハンドラ (`src/mcp/tools/tasks/handlers.ts:42-46, 134-137`) は 3 引数を受領して Core へ流す — ✅
- `task_edit` ハンドラはコード差分上で **直接の追加が見えない**。`TaskEditArgs` に 3 フィールドを追加し (`src/types/task-edit-args.ts:40-42`)、`buildTaskUpdateInput` が拾う (`src/utils/task-edit-builder.ts:209-223`) ため経路は通る。ただし MCP の入力 schema 側で `"type": "number"` のみだと **null クリアが MCP 経由でできない不整合**。

→ **修正案**: `custom/src/budget/mcp/schema.ts` の `budgetEditSchemaProperties` で `type` を `["number", "null"]` / `["string", "null"]` に変更し、対応する `JsonSchema` の型定義が許容しなければ validator 側を補強する。

- `milestone_list` 出力に予算サマリが付与される — ✅ (`milestones/handlers.ts:324-345`)。**spec §5.3.3 の `milestone_get` は未確認**だが、spec §5.3.3 の要求である `totalEstimatedDays / totalActualDays / unestimatedTaskCount / doneWithoutActualCount` はバケット側 (`MilestoneBucket`) の augmentation で自動的に MCP レスポンスに含まれる経路。

### 3.9 §5.4 TUI 表示 — ❌ 未実装

- TUI タスク詳細ビューへの追加なし。CLI プレーン出力には実装済みだが TUI は別経路。

### 3.10 §5.5 設定 — ⚠️ 部分対応

- `BacklogConfig.completedStatuses?: string[]` を upstream 型に追加 — ✅
- `resolveCompletedStatuses` で `statuses` 配列存在チェック + 警告ログ + フォールバック — ✅
- ただし `bun run cli config get/set` 経由での読み書きは検証されていない (spec §5.5 の指示通り「初期スコープでは YAML 直接編集にフォールバック」許容範囲)。
- 提供される `backlog.config.yml` のテンプレートやマイグレーションヒントなし。

---

### 3.11 §7 表示フォーマット — ✅ 適合

- `formatDays(2)` → `"2d"`, `formatDays(2.5)` → `"2.5d"`, `formatDays(0)` → `"0d"`, `formatDays(null|undefined)` → `"-"` — `format.test.ts` で確認。
- `formatDaysDiff`: `±0d` / `+1d` / `-1d` — `format.test.ts:21-29` で確認。
- ストレージは `YYYY-MM-DD` 固定 — `frontmatter.ts:78` で `${match[1]}-${match[2]}-${match[3]}` に正規化。

### 3.12 §8 テスト計画 — ⚠️ 部分達成

| spec のテストファイル | 実装 |
|---------------------|------|
| `schema.test.ts` | ✅ 9 ケース |
| `frontmatter.test.ts` | ✅ 4 ケース |
| `auto-complete-date.test.ts` | ✅ 9 ケース |
| `rollup.test.ts` | ✅ 6 ケース |
| `cli.test.ts` | ❌ 未実装 (CLI 自体が未実装のため) |
| `mcp.test.ts` | ❌ 未実装 |

`cli.test.ts` / `mcp.test.ts` は CLI / MCP の機能完成度に依存する。CLI を別 PR にスコープ移すなら spec も更新すべき。

追加で実装されているテスト:
- `apply-input.test.ts` (6 ケース) — Core 入力適用ヘルパのカバレッジ。仕様書には明示がないが価値あり。
- `completed-statuses.test.ts` (6 ケース) — 完了状態解決の単体テスト。
- `format.test.ts` (9 ケース) — 表示フォーマットの単体テスト。

合計 61 ケース全 pass。**ロジック層のカバレッジは十分**。

---

## 4. コード品質・設計の所見

### 4.1 良い点

1. **Module augmentation の活用**: `custom/src/budget/types.ts` で upstream の型を非破壊に拡張。再利用するファイルは `import "../budget/types";` の副作用 import で済むため変更行数が極小。
2. **責務分離が明確**: `schema` / `frontmatter` / `auto-complete-date` / `completed-statuses` / `rollup` / `apply-input` / `format` の関数モジュールが単一責任。
3. **`applyBudgetUpdateInput` の `mutated` フラグ**: upstream の `updateTaskFromInput` が「変更あり判定」を持っているのに合わせて、自然に統合できる。
4. **`computeBudgetRollup` / `applyBudgetRollup` の分離**: 純粋関数 (テスト容易) と副作用関数の分離が綺麗。MCP `milestones/handlers.ts` では純粋版を直接使用しているのが good practice。
5. **`isCompletedStatus` の case-insensitive 比較**: ユーザの大文字小文字ばらつきを許容。
6. **`BudgetSummary` の `widthPercent = Math.min(rate, 1.2) * 100`**: 100% 超過時の視覚オーバーフローを 120% でクランプ。spec 規定外だが現実的判断。

### 4.2 改善余地

1. **`rollup.ts:97-100` の空 if ブロック (dead code)**: 削除推奨。意図不明の no-op が残ると後の読者が混乱する。
2. **`auto-complete-date.ts:14-33` の `prev` null 引数の扱い**: `prev = null` のとき `wasCompleted = false` になり、`next` が完了状態かつ `completedDate` 未設定なら当日値がセットされる。`applyCompletedDateOnCreate` と動作が重複するため、`update` 経路のみ呼ぶことを型レベルか docstring で明確化したい。
3. **Web の import パスに `.ts` 拡張子の不統一**: `MilestoneTaskRow.tsx` は `../../../custom/src/budget/format`、`BudgetFields.tsx` 内では `.ts` あり。プロジェクト全体の慣習に合わせるべき (Bun はどちらでも解決するため動作に影響なし)。
4. **MCP `budgetEditSchemaProperties` の `type` が `null` を許容しない**: §3.8 で詳述。修正必須。
5. **Milestone 詳細ページの 3 列追加が未実装**: §5.1.3 のレイアウト要件。`MilestoneTaskRow` のインライン行で代替されているが、`差分列` と `合計フッター行` がない。
6. **`task.estimatedDays = undefined` (`apply-input.ts:38, 51, 64`)**: `delete task.estimatedDays` の方が JSON シリアライズや等価比較で意図が明確。実用上は serializer 側で除外されるため害なし。
7. **`BudgetFields.tsx` の入力 commit タイミング**: `onBlur` のみで commit。`type="number"` の `Enter` キー押下時の保存挙動が不明確 (form submit を通る？)。spec §5.1.1 は「既存の保存フローでタスクを更新」とあるため OK だが、UX 観察が必要。

### 4.3 セキュリティ・データ整合性

- 入力バリデーションは Core 層 (`normalizeDaysValue` / `normalizeCompletedDateValue`) で集約済み。Web → API → Core すべての経路で通る。
- frontmatter 出力時の `applyBudgetToFrontmatter` は `roundTo2` で再丸めしており、想定外の浮動小数を書き込まない。
- `completedDate` の文字列は正規表現 + UTC Date 一致で実在チェック (`isValidYmdDate`)。インジェクション要素なし。

---

## 5. 既存ファイル変更の精査（FORK_NOTES「変更行数の最小化」）

| ファイル | 追加行 | 削除行 | 評価 |
|---------|-------|-------|------|
| `src/cli.ts` | 1 | 1 | ✅ `buildMilestoneBuckets` への `config` 引数追加のみ |
| `src/core/backlog.ts` | 11 | 0 | ✅ 3 箇所の委譲呼び出し (create / update / input 適用)、すべてマーカー付き |
| `src/core/milestones.ts` | 5 | 2 | ✅ オプション型に `config` 追加 + `applyBudgetRollupAll` 1 行 |
| `src/formatters/task-plain-text.ts` | 14 | 0 | ⚠️ `[Custom:start]/[Custom:end]` で囲った 12 行ブロック。`renderBudgetPlainText(task)` のような **1 関数委譲に出した方が FORK_NOTES の精神に近い** |
| `src/markdown/parser.ts` | 3 | 1 | ✅ `return` を分解して `applyBudgetFromFrontmatter` を挟む 2 行差分 |
| `src/markdown/serializer.ts` | 2 | 0 | ✅ 委譲呼び出し 1 行 + import 1 行 |
| `src/mcp/tools/milestones/handlers.ts` | 23 | 1 | ⚠️ `[Custom:start]/[Custom:end]` の 21 行ブロックを `enrichMilestoneListLines(...)` のような関数に切り出すと FORK_NOTES 適合度がさらに上がる |
| `src/mcp/tools/tasks/handlers.ts` | 8 | 0 | ✅ args 型に 3 行追加 + create handler で 3 行追加 |
| `src/mcp/utils/schema-generators.ts` | 3 | 0 | ✅ spread 1 行 × 2 + import 1 行 |
| `src/server/index.ts` | 25 | 0 | ⚠️ PUT エンドポイントの 19 行ブロックを `applyBudgetServerInputs(updateInput, updates)` のような関数に切り出すと FORK_NOTES 適合度がさらに上がる |
| `src/types/index.ts` | 1 | 0 | ✅ `completedStatuses` 1 行 |
| `src/types/task-edit-args.ts` | 3 | 0 | ✅ |
| `src/utils/task-edit-builder.ts` | 17 | 0 | ⚠️ `[Custom:start]/[Custom:end]` の 17 行ブロック。`applyBudgetTaskEditArgs(updateInput, args)` のような委譲関数化が望ましい |
| `src/web/App.tsx` | 1 | 0 | ✅ |
| `src/web/components/MilestoneTaskRow.tsx` | 12 | 0 | ⚠️ JSX 10 行ブロック。`<BudgetInlineRow task={task} />` コンポーネント化が望ましい |
| `src/web/components/MilestonesPage.tsx` | 7 | 5 | ✅ |
| `src/web/components/TaskDetailsModal.tsx` | 13 | 1 | ✅ 型 Omit + コンポーネント埋め込み 7 行 |
| `src/web/lib/api.ts` | 7 | 1 | ✅ |

**サマリ**: 大半は FORK_NOTES の「呼び出し 1 行に留める」原則に合致。**5 ファイルで「インライン展開ブロック」が残っている**ため、これらを `custom/` 側の関数 / コンポーネントに切り出すと upstream マージコンフリクト耐性がさらに上がる。

---

## 6. 既知の未実装スコープ（差分への補完が必要）

仕様書 §1.2 に含まれるが、現コミットで実装されていない範囲を一覧化。

| spec § | 項目 | 推定追加コスト |
|--------|------|--------------|
| §5.1.3 | Milestone 詳細ページのタスクテーブル 3 列 + 合計フッター | 中 (新規コンポーネント 1 + 既存テーブル 1 行) |
| §5.1.4 | ソート対応 (`estimatedDays` / `actualDays` / `completedDate`) | 中 (既存 sort ロジックの拡張) |
| §5.2.1 | CLI フラグ (`--estimated-days` 等) | 中 |
| §5.2.2 | `task list --sort estimated-days` | 小 |
| §5.4 | TUI タスク詳細への表示行追加 | 小 |
| §5.5 | `bun run cli config` 経由の `completedStatuses` 読み書き検証 | 小 |
| §8.2 | `cli.test.ts` / `mcp.test.ts` | 中 |
| §8.3 | `custom/spec/manual_test_budget_management.md` 整備 | 小 |
| MCP edit schema | `null` 許容 (`type: ["number", "null"]`) | 極小 |

これらを別 PR で完了させるなら、本 PR のスコープを spec 側で明示更新するか、PR 本文で範囲を明記すべき。

---

## 7. 受け入れ条件チェック (spec §9)

| 条件 | 状態 |
|------|------|
| `Task` 型に 3 フィールド augment | ✅ |
| frontmatter の往復 | ✅ |
| バリデーションが §4.1 通り | ✅ |
| `completedDate` 自動セット・保持が §4.2 通り | ✅ |
| `MilestoneBucket` 集計値追加 + Active かつ Leaf | ✅ |
| Archive 除外 | ✅ (呼び出し元責任) |
| `BacklogConfig.completedStatuses` 読み込み + フォールバック | ✅ |
| Web UI 編集モーダル / Milestone カード / 詳細ページ | ⚠️ 詳細ページの 3 列・合計行が未実装 |
| CLI `task create` / `edit` / `list` / `view` | ❌ `view` のみ |
| MCP `task_*` / `milestone_*` | ⚠️ edit の null 許容 schema 未対応 |
| TUI タスク詳細 | ❌ |
| 編集不可タスクで budget 編集拒否 | ✅ (`disabled` UI + Core レイヤ) |
| §8.2 テスト pass | ⚠️ 5/7 ファイル (`cli.test.ts` / `mcp.test.ts` 未) |
| `bunx tsc --noEmit` pass | ✅ |
| `bun run check` pass | 未検証（推奨実行）|
| upstream 既存ファイル変更がすべて呼び出し 1 行 + マーカー | ⚠️ 5 ファイルでブロック展開が残る |
| §8.3 手動検証 | 未実施（PR レビュー時に実施推奨）|

---

## 8. 推奨アクション

### 8.1 マージ前に対応すべき (Must)

1. `rollup.ts:97-100` の空 if ブロックを削除、もしくは Archive 除外責務を明示するコメントに変える。
2. `custom/src/budget/mcp/schema.ts` の `budgetEditSchemaProperties` を `type: ["number", "null"]` / `["string", "null"]` に変更し、`task_edit` で null クリアできるようにする。
3. PR 本文に「未実装スコープ」を明記し、追跡 issue / 後続 task を起票する。

### 8.2 追加 PR で対応 (Should)

1. **§5.2 CLI フラグの実装**: `custom/src/budget/cli/flags.ts` を新規作成し、`task create` / `edit` / `list` / `view` に結線。
2. **§5.1.3 Milestone 詳細ページのテーブル拡張**: `custom/src/budget/web/BudgetColumns.tsx` を実装、合計フッター行を含める。
3. **§5.1.4 ソート**: `estimatedDays` / `actualDays` / `completedDate` のソート対応。
4. **§5.4 TUI 表示行の追加**。
5. `cli.test.ts` / `mcp.test.ts` を整備。
6. `custom/spec/manual_test_budget_management.md` の作成。

### 8.3 リファクタリング機会 (Nice to have)

1. `task-plain-text.ts` / `milestones/handlers.ts` / `server/index.ts` / `task-edit-builder.ts` / `MilestoneTaskRow.tsx` の `[Custom:start]/[Custom:end]` 内ブロックを `custom/` 側関数 / コンポーネントに抽出。FORK_NOTES の「実装の実体は新規クラス・モジュール」原則をさらに徹底。
2. `apply-input.ts` 内の `task.X = undefined` を `delete task.X` に変更（意図明確化）。
3. `BudgetFields.tsx` の入力 commit を `onBlur` だけでなく `Enter` キー押下にも反応させる。
4. 既存テストの近傍に `auto-complete-date` の「edit で `prev` が null のとき = 新規作成時 fallback」のケースを追加し、`applyCompletedDateOnTransition` と `applyCompletedDateOnCreate` の責務境界をテストで固定する。

---

## 9. 総評

- **Core 層**: 設計・実装・テストともに高品質。spec §3〜§4 に厳密準拠。即マージ可能。
- **Surface 層**: Web UI (編集モーダル / カード) は実装済み。CLI / TUI / Milestone 詳細テーブル / ソートが未実装。コミットメッセージは「意図的なスコープ縮小」と説明しているが、spec はこれらを **同一スコープ** として書いている。後続 PR で補完する前提なら、spec 側か PR 本文で範囲再定義が望ましい。
- **FORK_NOTES 適合度**: ★★★★☆ (5 ファイルでインライン展開ブロックを残す以外は理想的)。
- **マージ可否**: §8.1 の Must を満たせばマージ可能。残スコープは follow-up issue で管理。
