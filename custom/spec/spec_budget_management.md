# 予算管理機能 (Budget Management) 仕様書

Backlog.md (Fork) に「タスク単位の見積工数 / 実績工数 / 完了実績日」を追加し、Milestone でロールアップ集計を行う機能の仕様。

- 関連ブランチ: `feature/budget-management`
- 関連ドメイン用語集: [`custom/spec/CONTEXT.md`](./CONTEXT.md)
- 適用 Fork ルール: [`FORK_NOTES.md`](../../FORK_NOTES.md)

---

## 1. 目的とスコープ

### 1.1 目的

タスクごとに以下 3 フィールドを管理し、Milestone 単位で予実を可視化する。

- **見積工数 (`estimatedDays`)** — タスク着手前の作業見積（日）
- **実績工数 (`actualDays`)** — タスク完了時の実工数（日）
- **完了実績日 (`completedDate`)** — タスクが完了状態に達した日付

### 1.2 スコープに含むこと

- Task 型・frontmatter への新フィールド追加（optional）
- 完了状態遷移時の `completedDate` 自動セット
- Milestone へのロールアップ集計と Web UI 表示
- CLI / MCP / Web UI からの編集対応
- TUI での表示対応（編集は対象外）
- ソート対応（フィルタは対象外）
- 完了状態を識別するための `BacklogConfig.completedStatuses` の追加

### 1.3 スコープに含まないこと（明示的に除外）

- タイムエントリ式の実績工数管理（複数エントリの累積）
- 既存タスクへの値の遡及自動補完
- フィルタリング機能（ステータス・優先度との複合フィルタ）
- E2E（ブラウザ）自動テスト
- TUI からの編集
- 工数単位の動的変換（hours / 人月など）
- 既存タスクファイル群への一括マイグレーション

---

## 2. ドメインモデル

ドメイン用語の正式な定義は [`CONTEXT.md`](./CONTEXT.md) を参照。要点のみ再掲。

- **Estimated Days / Actual Days** は `number`、単位は**日**、小数2桁まで、`>= 0`。
- **Completed Date** は `YYYY-MM-DD`。完了状態への遷移時に自動セット、手動上書き可、完了状態から戻しても保持。
- **Active Task** のみが Milestone 集計対象（**Archived Task はソフト削除扱いで集計対象外**）。
- **Leaf Task** のみが Milestone 集計対象（親タスクは入力可だが集計に含めない、二重計上防止）。
- **Completed Statuses** は `BacklogConfig.completedStatuses: string[]` で明示指定。未設定時は `statuses` 配列末尾 1 要素にフォールバック。

---

## 3. データモデル

### 3.1 TypeScript 型

upstream の `src/types/index.ts` は**変更しない**。代わりに `custom/src/budget/types.ts` で TS module augmentation により拡張する。

```ts
// custom/src/budget/types.ts
import type {} from "../../../src/types/index";

declare module "../../../src/types/index" {
    interface Task {
        estimatedDays?: number;
        actualDays?: number;
        completedDate?: string;
    }

    interface MilestoneBucket {
        totalEstimatedDays?: number;
        totalActualDays?: number;
        unestimatedTaskCount?: number;
        doneWithoutActualCount?: number;
    }

    interface TaskCreateInput {
        estimatedDays?: number;
        actualDays?: number;
        completedDate?: string;
    }

    interface TaskUpdateInput {
        estimatedDays?: number | null;
        actualDays?: number | null;
        completedDate?: string | null;
    }
}
```

`TaskUpdateInput` の各キーは `null` 受け付け = 値クリアの意図、`undefined` = 変更なしを示す（upstream の既存規約を踏襲）。

`BacklogConfig` への `completedStatuses` 追加は upstream 側に直接 1 行追加する（Q17b 決定事項）。

```ts
// src/types/index.ts (upstream 変更箇所)
export interface BacklogConfig {
    // ...既存フィールド...
    completedStatuses?: string[]; // [Custom] 完了として扱う status 集合。未指定時は statuses の末尾要素にフォールバック
}
```

### 3.2 frontmatter スキーマ

タスク .md ファイルの frontmatter に以下キーを追加する（optional、未入力時はキーごと出力しない）。

```yaml
---
id: BACK-123
title: 'Example task'
status: Done
# ... 既存フィールド ...
estimated_days: 2.5
actual_days: 1.75
completed_date: '2026-05-21'
---
```

- `estimated_days` / `actual_days`: 数値、小数2桁まで、`>= 0`。
- `completed_date`: 文字列、`YYYY-MM-DD` 形式（クォート必須、既存 `created_date` と同じ慣例）。
- いずれも値が `undefined` のときは frontmatter にキーごと書き出さない（差分最小化）。

### 3.3 既存タスクとの互換性

- マイグレーション不要。既存タスクファイルは無変更のまま動作する。
- 未指定キーは TS 型で `undefined` として読み込まれる。
- 新フィールド導入後に新規に完了状態へ遷移したタスクからのみ `completedDate` 自動セットが発火する（遡及適用なし）。

---

## 4. 振る舞い仕様

### 4.1 バリデーション

| フィールド | 制約 | 違反時の挙動 |
|------------|------|-------------|
| `estimatedDays` | `number`, `>= 0`, 小数2桁まで | 2桁を超える場合は2桁に丸める。負値・`NaN` / `Infinity` / 非数値は reject |
| `actualDays` | `number`, `>= 0`, 小数2桁まで | 同上 |
| `completedDate` | `string`, `YYYY-MM-DD` 形式、有効な日付 | フォーマット不正・存在しない日付（例 `2026-02-30`）は reject。未来日付は警告ログのみで許可 |

`null` 値は「クリア」を意味し、reject の対象外（`TaskUpdateInput` のみ）。

### 4.2 `completedDate` 自動セット

#### 発火条件

タスクの編集時 (`task edit`) または作成時 (`task create`) に、以下のいずれかに該当する場合に発火する。

1. ステータスが `* → completedStatuses に含まれる値` に変化した。
2. ステータスが `completedStatuses に含まれる値` で新規作成された。

#### 設定値

- `completedDate` が **未設定** の場合のみ当日値 (`YYYY-MM-DD`) で埋める。
- `completedDate` が **既に値を持つ** 場合は上書きしない（手動入力を尊重）。
- ステータス変更を伴わない編集では `completedDate` を変更しない。
- ステータスが `completedStatuses → それ以外` に戻る場合、`completedDate` は **クリアしない**（再オープン履歴を保持）。

#### 実装層

- **Core 層**に実装する（CLI/MCP/Web UI のどこから更新されても同じ挙動を保証）。
- 実体は `custom/src/budget/auto-complete-date.ts` の関数として実装し、upstream の task 更新ロジックから 1 行で委譲する。
- 日付フォーマットは `config.includeDateTimeInDates` の影響を受けず、常に `YYYY-MM-DD`（時刻含まず）。

### 4.3 Milestone ロールアップ

#### 集計対象

- **Active Task のみ**（`backlog/archive/tasks/` 配下のタスクは除外）。
- **Leaf Task のみ**（`subtasks` が非空のタスクは除外）。
- Milestone が紐付いていないタスクは集計対象外。

#### 集計値

`MilestoneBucket` に以下を追加（augmented）:

| フィールド | 定義 |
|------------|------|
| `totalEstimatedDays` | 対象タスクのうち `estimatedDays` が設定済みの値の合計 |
| `totalActualDays` | 対象タスクのうち `actualDays` が設定済みの値の合計 |
| `unestimatedTaskCount` | 対象タスクのうち `estimatedDays` が未設定の件数 |
| `doneWithoutActualCount` | 対象タスクのうちステータスが `completedStatuses` に含まれ、かつ `actualDays` が未設定の件数 |

- 母数が 0（対象タスクなし）の場合、`totalEstimatedDays` / `totalActualDays` は `undefined`。`unestimatedTaskCount` / `doneWithoutActualCount` は `0`。
- 浮動小数誤差を避けるため、合計時は `Math.round(value * 100) / 100` で 2 桁に丸める。

#### 派生指標（Web UI 表示用）

- **予算消化率** = `totalActualDays / totalEstimatedDays`（`totalEstimatedDays` が 0 または未定義のときは表示なし）
- **差分** = `totalActualDays - totalEstimatedDays`（負: 前倒し、正: 超過）

### 4.4 編集不可状態の扱い

`isLocalEditableTask(task) === false`（`source === "remote"` または `"local-branch"`）のタスクは budget フィールドも編集不可。

- Web UI / CLI / MCP で編集要求が来た場合、既存の編集不可エラーパスに乗せる（独自エラー定義は追加しない）。
- 表示は可能。Milestone 集計には通常通り含まれる。

---

## 5. サーフェスごとの仕様

### 5.1 Web UI

#### 5.1.1 タスク編集モーダル

既存の編集モーダルに 3 フィールドをインライン追加。配置順は既存の `dueDate` の直後。

```
[priority] [milestone] [dueDate]
[estimatedDays] [actualDays] [completedDate]   ← 新規（横並び 3 カラム）
```

- `estimatedDays` / `actualDays`: `<input type="number" step="0.01" min="0" />`。未入力時は空欄。
- `completedDate`: `<input type="date" />`。未入力時は空欄。
- ラベルは日本語表記: 「見積工数 (日)」「実績工数 (日)」「完了実績日」
- 値が変更されたら既存の保存フローでタスクを更新する（独自保存ボタンは追加しない）。
- 編集不可タスクではコントロールを `disabled` 表示。

#### 5.1.2 Milestone カード（一覧表示）

既存の Milestone カードに以下を追加:

```
┌─────────────────────────────────────────────┐
│ Milestone Name                              │
│ Tasks:  [████████░░░░] 8/12  (67%)          │ ← 既存（タスク数ベース）
│ Budget: [██████░░░░░░] 12.5d / 18.0d (69%)  │ ← 新規（工数ベース）
│   未見積 2件 / 実績未入力 1件                │ ← 新規バッジ
└─────────────────────────────────────────────┘
```

- バーの色:
  - `予算消化率 < 80%` → 緑
  - `80% <= 予算消化率 < 100%` → 黄
  - `予算消化率 >= 100%` → 赤
- バー右側の数値: `{totalActualDays}d / {totalEstimatedDays}d ({消化率}%)`
- 未入力件数バッジ: `unestimatedTaskCount > 0` または `doneWithoutActualCount > 0` のときのみ表示
- `totalEstimatedDays` が未定義の場合: バー非表示、「予算未設定」のテキストのみ
- 数値の整形は §7「表示フォーマット」に従う

#### 5.1.3 Milestone 詳細ページのタスクテーブル

既存のタスクテーブルに 3 列を追加:

| 列 | 値 |
|----|----|
| 見積 (d) | `estimatedDays`（未入力時 `-`） |
| 実績 (d) | `actualDays`（未入力時 `-`） |
| 差分 (d) | `actualDays - estimatedDays`（両方設定時のみ。負=前倒し、正=超過、`±0` 表記） |
| 完了日 | `completedDate`（未入力時 `-`） |

テーブル末尾に合計フッター行を追加し、`totalEstimatedDays` / `totalActualDays` / 差分合計を表示。

#### 5.1.4 ソート

タスク一覧テーブルの列ヘッダクリックで以下のソートを有効化:

- `estimatedDays` 昇順/降順
- `actualDays` 昇順/降順
- `completedDate` 昇順/降順

未入力値はソート順序に関わらず**末尾固定**。

### 5.2 CLI

#### 5.2.1 `task create` / `task edit` フラグ追加

```bash
backlog task create "Example" --estimated-days 2.5
backlog task edit BACK-123 --actual-days 1.75 --completed-date 2026-05-21
backlog task edit BACK-123 --estimated-days null  # クリア
```

| フラグ | 型 | 説明 |
|--------|----|------|
| `--estimated-days <value>` | number または `null` | 見積工数（日）。`null` でクリア |
| `--actual-days <value>` | number または `null` | 実績工数（日）。`null` でクリア |
| `--completed-date <YYYY-MM-DD>` | string または `null` | 完了実績日。`null` でクリア |

#### 5.2.2 `task list` ソート

```bash
backlog task list --sort estimated-days
backlog task list --sort -actual-days   # 降順
backlog task list --sort completed-date
```

既存の `--sort` オプションの value にこれらを追加する。

#### 5.2.3 `task view` プレーン出力

```
ID:        BACK-123
Title:     Example task
Status:    Done
Priority:  high
Milestone: m-1
Due:       2026-05-25
Estimated: 2.5d
Actual:    1.75d
Completed: 2026-05-21
```

未入力時は `-`、整形ルールは §7 に従う。

### 5.3 MCP

#### 5.3.1 `task_create` / `task_edit` パラメータ追加

入力スキーマに 3 プロパティを追加:

```json
{
  "estimatedDays": {
    "type": ["number", "null"],
    "minimum": 0,
    "description": "見積工数（日、小数2桁まで）。null でクリア。"
  },
  "actualDays": {
    "type": ["number", "null"],
    "minimum": 0,
    "description": "実績工数（日、小数2桁まで）。null でクリア。"
  },
  "completedDate": {
    "type": ["string", "null"],
    "pattern": "^\\d{4}-\\d{2}-\\d{2}$",
    "description": "完了実績日（YYYY-MM-DD）。null でクリア。"
  }
}
```

スキーマ断片は `custom/src/budget/mcp/schema.ts` で定義し、upstream の tool 定義側で 1 行マージする。

#### 5.3.2 `task_list` / `task_view` 出力

返却 JSON に上記 3 フィールドを含める。値が未設定の場合はフィールドごと出力しない（`undefined`）。

#### 5.3.3 `milestone_get` / `milestone_list` 出力

Milestone レスポンスに `totalEstimatedDays` / `totalActualDays` / `unestimatedTaskCount` / `doneWithoutActualCount` を含める。

### 5.4 TUI

- タスク詳細ビューに 3 フィールドを**表示のみ**追加（編集 UI は提供しない）。
- 表示位置は CLI `task view` プレーン出力と同等のレイアウト。
- Kanban ボードのカード表示には追加しない（情報密度を保つため）。

### 5.5 設定 (`backlog.config.yml`)

新規キー `completedStatuses`:

```yaml
projectName: My Project
statuses:
  - To Do
  - In Progress
  - Done
  - Cancelled
completedStatuses:
  - Done
  - Cancelled
```

- 型: `string[]`
- 各値は `statuses` 配列内に存在する必要がある。存在しない値は警告ログを出して無視（読み込み継続）。
- 未指定時は `[statuses[statuses.length - 1]]` にフォールバック。
- 操作:
  - 第一選択肢として upstream の `bun run cli config get/set/list` で読み書きできるかを実装着手時に検証する。
  - 既存の汎用 config ロジックが配列型の未知キーに対応していない場合は、初期スコープでは YAML 直接編集にフォールバックする。

---

## 6. アーキテクチャ

### 6.1 ディレクトリ構成

```
custom/
  spec/
    CONTEXT.md                       # ドメイン用語集
    spec_budget_management.md        # 本仕様書
  src/
    budget/
      types.ts                       # TS module augmentation
      schema.ts                      # バリデーション・丸めロジック
      frontmatter.ts                 # frontmatter ↔ Task のマッピング
      auto-complete-date.ts          # Done 遷移時の completedDate 自動セット
      rollup.ts                      # Milestone 集計（Active かつ Leaf）
      format.ts                      # 数値・日付の表示整形
      web/
        BudgetFields.tsx             # Task 編集モーダル用コンポーネント
        BudgetSummary.tsx            # Milestone カード用プログレスバー
        BudgetColumns.tsx            # Milestone 詳細タスクテーブル用列
      cli/
        flags.ts                     # CLI フラグ定義と適用
      mcp/
        schema.ts                    # MCP tool schema 断片
  tests/
    budget/
      schema.test.ts
      frontmatter.test.ts
      auto-complete-date.test.ts
      rollup.test.ts
      cli.test.ts
      mcp.test.ts
```

### 6.2 upstream へのタッチポイント

FORK_NOTES.md の「変更行数の最小化」ルールに従い、upstream 既存ファイルへの変更は**生成・呼び出しのみ**に限定する。実装着手時に正確な行と関数名を特定する。

| ファイル（推定） | 変更内容 | 行数目安 |
|-----------------|---------|---------|
| `src/types/index.ts` | `BacklogConfig.completedStatuses?: string[]` を追加（マーカー付き） | 1 |
| `src/markdown/parser.ts`（frontmatter → Task 変換箇所） | `applyBudgetFromFrontmatter(task, frontmatter)` を呼び出す | 1 |
| `src/markdown/serializer.ts`（Task → frontmatter 変換箇所） | `applyBudgetToFrontmatter(frontmatter, task)` を呼び出す | 1 |
| `src/core/task.ts`（task edit / create の永続化直前） | `applyCompletedDateOnTransition(prevTask, nextTask, config)` を呼び出す | 1〜2 |
| `src/core/milestone.ts`（`MilestoneBucket` 構築箇所） | `applyBudgetRollup(bucket, tasks)` を呼び出す | 1 |
| `src/web/components/TaskEditModal.tsx` | `<BudgetFields task={task} onChange={onChange} />` を埋め込み | 1 |
| `src/web/components/MilestoneCard.tsx` | `<BudgetSummary bucket={bucket} />` を埋め込み | 1 |
| Milestone 詳細ページのタスクテーブルコンポーネント | `<BudgetColumns />` を埋め込み | 1 |
| `src/cli/commands/task-create.ts` / `task-edit.ts` | `registerBudgetFlags(command)` 1 行 + handler 内で `applyBudgetFlags(args, input)` 1 行 | 2 × 各ファイル |
| `src/cli/commands/task-list.ts` | ソート value への追加（既存配列に 3 値追加） | 3 |
| `src/cli/commands/task-view.ts`（プレーン出力箇所） | `renderBudgetPlainText(task)` を呼び出す | 1 |
| `src/mcp/tools/task-create.ts` / `task-edit.ts` | schema 断片を spread でマージ + handler 内で `applyBudgetMcpInput` 1 行 | 2 × 各ファイル |
| `src/mcp/tools/task-list.ts` / `task-view.ts` / `milestone-*.ts` | 出力 builder で `enrichWithBudget(output, task)` を呼び出す | 1 × 各ファイル |
| `src/tui/components/TaskDetail.tsx` 相当 | `renderBudgetTuiBlock(task)` を呼び出す | 1 |

すべてのタッチポイントにマーカーコメント (`// [Custom] 予算管理機能の委譲呼び出し`) を付ける。

実装の実体は `custom/src/budget/` 配下の関数・コンポーネントが持ち、upstream 側は呼び出し 1 行に留める。

### 6.3 frontmatter パーサが未知キーをドロップする場合の対応

実装着手時に upstream の YAML パーサが未知キーを保持するか検証する。

- **保持する場合**: パース後の plain object を読み出して Task 型に注入する形で済む（追加改修不要）。
- **ドロップする場合**: パーサに「未知キー保持モード」を追加するか、`custom/` 内で raw YAML を再パースする補助レイヤを追加する。upstream 既存ファイル変更は最小行に留める。

---

## 7. 表示フォーマット

### 7.1 数値（工数）

スマート整形 + `d` サフィックス:

| 値 | 表示 |
|---|------|
| `2` | `2d` |
| `2.5` | `2.5d` |
| `0.25` | `0.25d` |
| `0` | `0d` |
| `undefined` / `null` | `-` |

実装: `custom/src/budget/format.ts:formatDays(value)`

```ts
function formatDays(value: number | null | undefined): string {
    if (value == null) return "-";
    const rounded = Math.round(value * 100) / 100;
    const text = Number.isInteger(rounded) ? rounded.toString() : rounded.toString();
    return `${text}d`;
}
```

### 7.2 日付（完了実績日）

- ストレージ: `YYYY-MM-DD` 固定
- Web UI 表示: `config.dateFormat` に従う（既存 `createdDate` 表示と同じロジックを再利用）
- CLI / MCP / TUI 表示: `YYYY-MM-DD` 固定
- 未入力: `-`

---

## 8. テスト計画

### 8.1 配置

```
custom/tests/budget/
  schema.test.ts
  frontmatter.test.ts
  auto-complete-date.test.ts
  rollup.test.ts
  cli.test.ts
  mcp.test.ts
```

### 8.2 テスト項目

#### `schema.test.ts`（ユニット）
- `>= 0` を満たす値が通る（`0`, `0.25`, `2.5`, `100`）
- 負値・`NaN` / `Infinity` / 非数値は reject
- 小数3桁以上は2桁に丸められる
- 日付フォーマット (`YYYY-MM-DD`) のバリデーション
- 不正な日付（`2026-02-30` 等）は reject
- 未来日付は警告のみ通過

#### `frontmatter.test.ts`（統合）
- Task → frontmatter → Task の往復で値が保たれる
- `undefined` フィールドは frontmatter にキーごと出力されない
- 既存タスク（新フィールドなし）が壊れずに読み込める
- frontmatter に新キーがあるタスクが正しく Task 型に変換される

#### `auto-complete-date.test.ts`（統合）
- ステータス `To Do → Done` で `completedDate` が当日値にセットされる
- 既に `completedDate` がある状態で `Done` 維持しても上書きされない
- `Done → To Do` 戻りで `completedDate` は保持される
- `completedStatuses: ["Done", "Cancelled"]` 設定で `Cancelled` 遷移時も発火する
- `completedStatuses` 未設定時は `statuses` 配列末尾遷移で発火する
- 新規作成時にステータスが `completedStatuses` に含まれれば自動セット

#### `rollup.test.ts`（ユニット + 統合）
- Active Leaf タスクのみが集計対象
- Archive タスクは集計対象外
- Parent タスク（subtasks 非空）は集計対象外
- `estimatedDays` 未入力タスクは `totalEstimatedDays` から除外され、`unestimatedTaskCount` に計上
- `completedStatuses` かつ `actualDays` 未入力タスクは `doneWithoutActualCount` に計上
- 浮動小数の合計が 2 桁で丸められる
- 集計対象 0 件時の挙動（合計 `undefined`、件数 `0`）

#### `cli.test.ts`（統合）
- `--estimated-days 2.5` でタスクファイルに書き込まれる
- `--estimated-days null` でフィールドがクリアされる
- 不正値で適切なエラーが出る
- `task list --sort estimated-days` でソート結果が正しい
- `task view` プレーン出力に新フィールドが現れる

#### `mcp.test.ts`（統合）
- `task_create` / `task_edit` ツールが新パラメータを受け付ける
- 不正値で適切な MCP エラーレスポンスが返る
- `task_list` / `task_view` レスポンスに値が含まれる
- `milestone_get` レスポンスに集計値が含まれる

### 8.3 手動検証手順（Web UI）

E2E 自動テストは初期スコープ外。代わりに以下の手動検証手順を `custom/spec/manual_test_budget_management.md` として後続で整備する（本仕様書とは別ファイル）。

- Task 編集モーダルで 3 フィールドを入力 → 保存 → 再読み込みで値が保たれる
- ステータスを `Done` に変更 → `completedDate` が当日値で表示される
- `completedDate` を手で別日付に変更 → 保存して反映される
- ステータスを `Done` から `To Do` に戻す → `completedDate` が保持されている
- Milestone カードでプログレスバーが表示される
- Milestone 詳細ページのタスクテーブルに 3 列が表示される
- 編集不可タスク（他ブランチ由来）では入力欄が disabled になる

---

## 9. 受け入れ条件

実装完了の判定基準。

- [ ] `Task` 型に `estimatedDays` / `actualDays` / `completedDate` が optional として augment される
- [ ] frontmatter の読み書きで上記 3 キーが往復する（未指定時は出力されない）
- [ ] バリデーションが §4.1 の表通りに動作する
- [ ] 完了状態遷移時に `completedDate` が §4.2 の規則通りに自動セット・保持される
- [ ] `MilestoneBucket` に集計値が追加され、Active かつ Leaf なタスクのみが集計対象になる
- [ ] Archive タスクが集計から除外される
- [ ] `BacklogConfig.completedStatuses` が読み込まれ、未指定時に `statuses` 末尾要素にフォールバックする
- [ ] Web UI の Task 編集モーダル / Milestone カード / Milestone 詳細ページに表示・編集 UI が追加される
- [ ] CLI の `task create` / `task edit` / `task list` / `task view` で対応フラグ・出力が動作する
- [ ] MCP の `task_*` / `milestone_*` ツールに新パラメータ・出力が追加される
- [ ] TUI のタスク詳細に新フィールドが表示される（編集は不可）
- [ ] 編集不可タスク（`isLocalEditableTask === false`）では budget 編集も拒否される
- [ ] §8.2 のテスト項目がすべて pass する
- [ ] `bunx tsc --noEmit` が pass する
- [ ] `bun run check` が pass する
- [ ] upstream 既存ファイルへの変更がすべて呼び出し 1 行に留まり、マーカーコメントが付与されている
- [ ] §8.3 の手動検証手順がすべて成功する

---

## 10. 想定リスクと対処

| リスク | 対処 |
|--------|------|
| upstream の YAML パーサが未知キーをドロップする | 実装着手時に検証。ドロップする場合は `custom/` 側で raw YAML を読み直すか、パーサに保持モードを追加（最小行数で） |
| upstream の `config get/set` 汎用ロジックが配列型未知キー非対応 | YAML 直接編集にフォールバックし、CLI 露出は初期スコープ外とする |
| upstream に既存の「完了状態判定ヘルパ」がある | 重複実装を避けるため再利用する。なければ `custom/src/budget/` 内で実装 |
| Milestone 詳細ページの列追加で表示崩れ | レスポンシブ対応を初期スコープに含む。CSS は `custom/` 配下のスタイルファイルで管理 |
| `MilestoneBucket` の型 augmentation が upstream の型推論と衝突 | 衝突した場合はインターフェース分離（`BudgetEnrichedBucket` 等の派生型）を検討 |

---

## 11. 実装順序の推奨

1. **CONTEXT.md と本仕様書のレビュー** — チーム内合意を取る。
2. **Core 層（型・スキーマ・frontmatter・自動セット・rollup）** — `custom/src/budget/{types,schema,frontmatter,auto-complete-date,rollup,format}.ts` を実装し、ユニット + 統合テストを完成させる。
3. **upstream タッチポイントの結線** — frontmatter パーサ・task 更新ロジック・milestone 計算箇所に呼び出し 1 行を追加。
4. **CLI** — `custom/src/budget/cli/flags.ts` 実装 + upstream CLI コマンドへの結線。`cli.test.ts` 完成。
5. **MCP** — `custom/src/budget/mcp/schema.ts` 実装 + upstream MCP tool への結線。`mcp.test.ts` 完成。
6. **Web UI** — `BudgetFields` / `BudgetSummary` / `BudgetColumns` 実装 + 既存コンポーネントへの埋め込み。手動検証。
7. **TUI** — 表示ブロック追加。
8. **設定対応** — `completedStatuses` の upstream `BacklogConfig` 追加と config CLI 動作確認。
9. **README / DEVELOPMENT.md 等への追記** — `custom/README.md` に予算管理機能の概要を追記。

---

## 12. 用語と参照

- ドメイン用語集: [`custom/spec/CONTEXT.md`](./CONTEXT.md)
- アーキテクチャ決定記録 (ADR):
  - [`adr/0001-budget-impl-in-custom.md`](./adr/0001-budget-impl-in-custom.md) — 実装を custom/ に閉じ、upstream タッチポイントを呼び出し 1 行に限定する
  - [`adr/0002-archive-excluded-from-rollup.md`](./adr/0002-archive-excluded-from-rollup.md) — Archive されたタスクは Milestone 予算ロールアップの対象外とする
  - [`adr/0003-parent-task-budget-input-but-excluded-from-rollup.md`](./adr/0003-parent-task-budget-input-but-excluded-from-rollup.md) — 親タスクの見積/実績は入力可とするが Milestone ロールアップには含めない
- Fork 運用ルール: [`FORK_NOTES.md`](../../FORK_NOTES.md)
- 既存 Task 型定義: `src/types/index.ts:26-62`
- 既存 MilestoneBucket 型定義: `src/types/index.ts:64-75`
- 既存 BacklogConfig 型定義: `src/types/index.ts:281-331`
- 編集可否判定: `src/types/index.ts:85` (`isLocalEditableTask`)
