---
status: accepted
date: 2026-05-21
---

# 予算管理機能の実装を custom/ に閉じ、upstream タッチポイントを呼び出し 1 行に限定する

予算管理（見積工数 / 実績工数 / 完了実績日）はタスク永続化・編集ロジック・Web UI・CLI・MCP・TUI を横断する機能だが、本リポジトリは Fork であり [`FORK_NOTES.md`](../../../FORK_NOTES.md) の「変更行数の最小化」ルールに従う必要がある。実装の実体は `custom/src/budget/` 配下の新規モジュール群に置き、upstream 既存ファイルへの変更は型 augmentation・委譲呼び出し・コンポーネント埋め込みの 1 行ずつに限定する方針を採る。upstream 取り込み時のコンフリクトを最小化し、Fork 独自改変箇所のレビューを容易にすることが目的。

## Considered Options

- **(採用) Frontmatter + 委譲モジュール方式** — タスクの frontmatter に `estimated_days` / `actual_days` / `completed_date` を追加。Task 型・MilestoneBucket 型は TS module augmentation で拡張し、upstream 型定義ファイルは無変更。各サーフェスの結節点で 1 行の委譲呼び出しを upstream に追加する。
- **サイドカーファイル方式** — タスク .md ファイルには budget を書かず、`backlog/budget/<task-id>.json` のような別ファイルに保存する。upstream への変更行数は最小だが、Backlog.md の「タスクは markdown 単独で自己完結」という根本コンセプトを壊し、archive/move/rename 時の追従ロジックが必要になる。
- **Repository ラッパ方式** — 既存 TaskStore を decorator パターンで包む。ストレージ層はクリーンだが、Web UI / CLI / MCP の入力面で結局同じだけのタッチポイントが発生し、複雑度に見合わない。

## Consequences

- upstream の YAML パーサが未知 frontmatter キーをドロップする実装だった場合、`custom/` 側で raw YAML を読み直すか、パーサに「未知キー保持モード」を最小行数で追加する必要がある。実装着手時に検証する。
- `BacklogConfig.completedStatuses` のみは型 augmentation で完全に閉じることが難しく、upstream `src/types/index.ts` の `BacklogConfig` interface に 1 行 + マーカーコメントを追加する例外を許容する。
- 将来 budget 機能を upstream 本体にマージする提案を出す場合は、本 ADR の方針を反転して `src/` 直下への統合に戻す必要がある。その際は本 ADR を superseded として更新する。
