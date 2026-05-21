---
status: accepted
date: 2026-05-21
---

# Archive されたタスクは Milestone 予算ロールアップの対象外とする

`backlog/archive/tasks/` 配下のタスクは「完了履歴」ではなく**ソフト削除されたタスク**である、というドメイン定義を採用する。したがって Milestone の予算ロールアップ（`totalEstimatedDays` / `totalActualDays` / `unestimatedTaskCount` / `doneWithoutActualCount`）は **Active なタスクのみ**を母数とし、Archive されたタスクは集計に含めない。多くの予算管理システムが「Archive = 完了済み」として実績側に積み上げる慣習を採るのに対し、本プロジェクトでは Archive と完了状態（`completedStatuses`）を明確に別概念として扱う。

## Considered Options

- **(採用) Archive は集計対象外（ソフト削除扱い）** — Archive されたタスクは Milestone 集計から完全に除外する。Milestone の予実は「現在 active な作業範囲」を表す。
- **Archive も集計対象内（完了履歴扱い）** — Archive されたタスクの見積・実績も合算する。長期マイルストーンの「総工数」を後から振り返れる利点があるが、Archive の本来の意味（ソフト削除）と矛盾する。
- **見積は除外・実績のみ加算** — 不対称の集計となり、予実差分が常に負方向にずれて意味を成さない。

## Consequences

- 完了したタスクを Milestone 集計から外したい場合、ユーザーは Archive ではなく `completedStatuses` への status 遷移で対応する必要がある。Archive はあくまで「タスク自体を消す」操作として位置づける。
- Milestone を完全に「閉じる」運用（completed milestones）を後から導入する場合、本 ADR の方針と整合させるためには「Archive とは別の milestone 単位のクローズ状態」を新規に定義する必要がある。
- Archive 操作のドキュメント（CLI ヘルプ・MCP 説明）に「Archive はソフト削除であり、完了実績の集計には反映されない」旨を明記する。
