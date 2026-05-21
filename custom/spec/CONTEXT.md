# Budget Management Context

Fork 独自の「予算管理」機能のドメイン文脈。タスクの見積工数・実績工数・完了実績日を扱い、マイルストーン単位でロールアップ集計する。

## Language

**Task**:
作業の最小単位。`backlog/tasks/<id>.md` として markdown ファイルで保存される。
_Avoid_: Issue, Ticket

**Estimated Days**（`estimatedDays` / frontmatter: `estimated_days`）:
タスクの作業見積。単位は日（days）、`number` 型、小数2桁まで、`>= 0`。未入力 = `null`/`undefined`。
_Avoid_: Estimate, Budget Hours, Effort

**Actual Days**（`actualDays` / frontmatter: `actual_days`）:
タスクの実績工数。単位は日（days）、`number` 型、小数2桁まで、`>= 0`。単一値の上書きで更新する（タイムエントリ累積ではない）。未入力 = `null`/`undefined`。
_Avoid_: Spent, Logged Time, Time Tracked

**Completed Date**（`completedDate` / frontmatter: `completed_date`）:
タスクが完了状態に達した日付。`YYYY-MM-DD` 形式。完了状態への遷移時に自動セット、手動上書き可、完了状態から戻しても保持。
_Avoid_: Done Date, Finished At, Closed Date

**Completed Statuses**（`BacklogConfig.completedStatuses: string[]`）:
完了として扱うステータス名の集合。`completedDate` 自動セットの発火条件、および集計時の「完了タスク」判定の基準。未設定時は `statuses` 配列の末尾 1 要素にフォールバック。
_Avoid_: Done Statuses, Terminal Status

**Leaf Task**:
`subtasks` を持たない（または空）のタスク。Milestone のロールアップ集計はリーフタスクのみを母数とし、親タスクの値は集計に含めない（二重計上防止）。
_Avoid_: Child Task, Atomic Task

**Parent Task**:
`subtasks` を 1 件以上持つタスク。見積/実績の入力は許可するが、Milestone 集計には含めない。詳細ページでは参考表示として「サブタスク合計」を併記する。
_Avoid_: Epic, Story

**Active Task**:
`backlog/tasks/` 配下に存在する、現在管理対象のタスク。Milestone 集計の対象。
_Avoid_: Open Task, Live Task

**Archived Task**:
`backlog/archive/tasks/` 配下に移動されたタスク。**ソフト削除されたタスクであり、完了履歴ではない**。Milestone 集計の対象外。
_Avoid_: Completed Task, Closed Task, Done Task（"Done" は status の話、Archive は別概念）

**Milestone Rollup**:
Milestone に属する Active かつ Leaf なタスク群から、見積合計・実績合計・未入力件数を計算する集計処理。
_Avoid_: Aggregation, Summary

**Unestimated Task Count**（`unestimatedTaskCount`）:
Milestone 内で `estimatedDays` が未入力の Leaf Active タスクの件数。

**Done Without Actual Count**（`doneWithoutActualCount`）:
Milestone 内でステータスが完了状態（`completedStatuses` に含まれる）かつ `actualDays` が未入力の Leaf Active タスクの件数。

## Relationships

- A **Task** has zero or one **Estimated Days**, zero or one **Actual Days**, zero or one **Completed Date**.
- A **Milestone** contains many **Tasks**; **Milestone Rollup** aggregates over its **Leaf Active Tasks** only.
- A **Parent Task** has many child **Tasks** (via `subtasks`); the parent's own budget fields are not included in **Milestone Rollup**.
- An **Archived Task** is excluded from **Milestone Rollup** (treated as soft-deleted, not as completed work).
- A **Task** transitions into one of the **Completed Statuses** triggers automatic **Completed Date** assignment.

## Example dialogue

> **Dev:** 「Milestone の進捗バーには Archive タスクの実績工数も含めますか？」
> **Domain expert:** 「いいえ。Archive は完了ではなく**ソフト削除**です。集計対象は Active かつ Leaf なタスクのみ。」
>
> **Dev:** 「親タスクに見積を入れてサブタスクにも見積を入れると、合計が二重になりませんか？」
> **Domain expert:** 「保存はどちらもできますが、Milestone 集計には**リーフのみ**を含めるので二重計上にはなりません。親タスクの値は分解前の概算として残せます。」
>
> **Dev:** 「`Done` ステータスから別ステータスに戻したら `completedDate` はクリアされますか？」
> **Domain expert:** 「クリアしません。再オープン時の履歴を残します。再度完了に遷移したときも既存値があれば上書きしません。」
>
> **Dev:** 「`completedStatuses` に複数指定するのはどんな場面ですか？」
> **Domain expert:** 「例えば `["Done", "Cancelled"]` のように設定すると、中止したタスクの中止日も実績日として記録されます。」

## Flagged ambiguities

- 「完了」という日本語が **status の完了状態**（`Done` 等）と **Archive 状態**の両方に使われがちだったが、これは別概念として明確に区別する: **Completed Status** は status の話、**Archived Task** はソフト削除の話。**Milestone Rollup** での扱いも異なる（Completed Status は集計対象内、Archived は対象外）。
- 「見積工数」「実績工数」の「工数」は時間ではなく**日**（days）単位で扱う。`hours` の単位とは混在させない。
