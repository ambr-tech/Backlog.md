# Fork リポジトリ運用ルール

本リポジトリは upstream の Fork である。upstream との差分を最小化し、追跡しやすい状態を保つために、以下のルールに従うこと。

## 基本方針

- 本リポジトリは Fork リポジトリである。
- オリジナル(upstream)のリポジトリのファイルの変更は最小限に留めること。
- 新規ファイルは `[Root]/Custom/` 配下に配置すること。
- コミットメッセージの冒頭には `[Custom] ` を付与すること。
	- 例: `[Custom] Add fork-specific deployment script`

## ブランチ運用

- Custom 用の作業ブランチは `custom/` プレフィックスを使うこと。
	- 例: `custom/add-deploy-script`, `custom/fix-windows-path`
- upstream 由来のタスクブランチ(`tasks/back-xxx-...`)とは混在させないこと。
- `main` は本 Fork の最新状態、`upstream-main` は upstream 追従用として扱う。

## 既存ファイルを変更する場合

原則として `Custom/` 配下からの拡張で対応すること。やむを得ず既存ファイルを変更する場合は、変更箇所をマーカーコメントで明示し、upstream を取り込む際に追跡できる状態を保つこと。

- 1 行の変更: 行末または直前に `// [Custom] <変更理由>` を付ける。
	- 例: `const port = process.env.PORT ?? 3000; // [Custom] allow env override`
- 複数行の変更: 範囲を以下のマーカーで囲む。

```ts
// [Custom:start] <変更理由>
... // 変更コード
// [Custom:end]
```

- コメント構文がファイル形式によって異なる場合は、その言語のコメント構文に合わせる(例: Markdown なら `<!-- [Custom] ... -->`、Shell なら `# [Custom] ...`)。
- マーカーコメントを残せないファイル形式(JSON など)を変更した場合は、コミットメッセージにその旨を明記すること。

## Custom/ 配下の構造例

Custom 配下は以下のような構成を推奨する。必要なディレクトリのみ作成すればよい。

```
Custom/
	src/        # Fork 独自のソースコード
	docs/       # Fork 独自のドキュメント
	scripts/    # Fork 独自のスクリプト
	tests/      # Fork 独自のテスト
```

upstream のディレクトリ構造を `Custom/` 内で模倣する必要はない。用途別に分けることを優先する。
