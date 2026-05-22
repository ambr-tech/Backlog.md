# Backlog.md 開発者ガイド (Fork)

本ドキュメントは、本 Fork リポジトリでの開発・ビルド・デバッグ・テストの手順を 1 ページにまとめたものである。
upstream の詳細仕様は [`README.md`](../README.md) / [`DEVELOPMENT.md`](../DEVELOPMENT.md) / [`ADVANCED-CONFIG.md`](../ADVANCED-CONFIG.md) を参照。
Fork 固有の運用ルールは [`FORK_NOTES.md`](../FORK_NOTES.md) を参照。

---

## 1. プロジェクト概要

- Bun + TypeScript で実装された CLI ツール。
- `backlog` コマンドとして `npm i -g backlog.md` 等で配布される単一バイナリ。
- 主要機能: タスク管理 CLI / ターミナル Kanban (TUI) / Web UI / MCP サーバー。
- ソースは `src/` 配下、ビルド成果物は `dist/backlog` に出力される。

主なディレクトリ構成 (抜粋):

```
src/
  cli.ts              # CLI エントリーポイント
  mcp/                # MCP サーバー実装
    server.ts         # createMcpServer エントリ
    tools/            # MCP ツール定義
    resources/        # 読み取り専用リソースアダプタ
  web/                # Web UI (React + Tailwind)
  guidelines/mcp/     # エージェント向け指示文書
scripts/              # 配布用 cli.cjs などのスクリプト
backlog/              # 本プロジェクト自身のタスク Markdown
custom/               # Fork 独自のファイル配置先 (本ファイル含む)
```

---

## 2. 前提環境

| 項目 | バージョン / 備考 |
|------|------------------|
| Bun | **1.2.23** を使用すること。1.3.x には websocket の CPU リグレッションがあり、`backlog browser` も影響を受ける ([oven-sh/bun#23536](https://github.com/oven-sh/bun/issues/23536))。CI も 1.2.23 で固定。 |
| Node.js | 配布用 `cli.cjs` 経由でのみ使用。直接の依存はなし。 |
| OS | macOS / Linux / Windows いずれも可。Windows は `bunfig.toml` でテストの timeout / smol が調整済み。 |
| Git | 本リポジトリ操作および Backlog.md の cross-branch 機能で使用。 |

---

## 3. 初期セットアップ

### 3.1 Bun のインストール (バージョン固定)

`1.3.x` には websocket の CPU リグレッションがあり `backlog browser` が影響を受けるため、**必ず `1.2.23` をインストールする**。Windows / macOS / Linux いずれも npm でバージョン固定インストールする。

```bash
npm install -g bun@1.2.23
```

**バージョン確認:**

```bash
bun --version   # => 1.2.23
```

> 既に新しい Bun (例: `1.3.14`) が入っている場合も、上記コマンドで `1.2.23` が上書きインストールされるので、追加のアンインストールは不要。

### 3.2 依存関係のインストール

```bash
bun install
```

`postinstall` で `bun2nix` が利用可能であれば `bun.nix` が更新される。Nix 環境を使わない場合はそのままで問題ない。

---

## 4. 日常的なコマンド

`package.json` の `scripts` および `AGENTS.md` に定義されているものを抜粋する。

### 4.1 開発実行

```bash
# CLI をソースから直接実行 (CSS ビルド込み)
bun run cli -- <subcommand>

# 例: タスク一覧
bun run cli -- task list

# 例: Web UI をブラウザで開く (既定ポート 6420 で自動起動)
bun run cli -- browser

# MCP サーバーをソースから直接起動 (stdio)
bun run mcp

# MCP サーバーをデバッグログ付きで起動
bun run mcp -- --debug
```

> `bun run cli` は内部で `bun run build:css && bun src/cli.ts` を実行する。Web UI のスタイルが必要ない場合は `bun src/cli.ts <subcommand>` で十分。

### 4.2 ビルド

```bash
# Web UI 用 CSS のみビルド
bun run build:css

# 本番用シングルバイナリビルド (dist/backlog)
bun run build
```

`bun run build` は `build:css` → `bun build --production --compile --minify` の順で実行し、`__EMBEDDED_VERSION__` を埋め込む。
ビルド後は `./dist/backlog --help` で動作確認できる。

#### クロスプラットフォームビルド (Windows + macOS arm64)

手元で Windows / macOS 両方のバイナリをまとめて生成する場合は `scripts/build-cross.ps1` を使う。
実行内容としては`build:css` を実行した上で、`bun-windows-x64-baseline` と `bun-darwin-arm64` 向けに `bun build --compile --minify` を順に呼び、`__EMBEDDED_VERSION__` には `package.json` の `version` の埋め込みを行う。

```powershell
# PowerShell から直接実行
./scripts/build-cross.ps1
```

```cmd
:: cmd / エクスプローラから実行する場合は同梱の .bat を使う
scripts\build-cross.bat
```

成果物は `dist/` に出力される。

| ターゲット | 出力 |
|------------|------|
| Windows x64 | `dist/backlog.exe` |
| macOS arm64 | `dist/backlog` |

> 配布用の公式リリースは GitHub Actions 側で行うため、本スクリプトはあくまで Fork でのローカル動作確認・配布用途。upstream の `release.yml` には触らない。

### 4.3 テスト

```bash
# 全テスト
bun test

# 特定ファイル
bun test <filename>
```

`bunfig.toml` により timeout は 10 秒、`smol = true` でメモリ使用量を抑制している (Windows / WSL2 向け)。

### 4.4 型チェック・Lint・Format

```bash
# TypeScript の型チェックのみ (出力なし)
bunx tsc --noEmit

# Biome による format + lint チェック
bun run check

# 自動修正付き
bun run format    # biome format --write .
bun run lint      # biome lint --write .
```

> Husky + lint-staged により、コミット時に staged ファイルへ自動で `biome check --write` が走る。Lint エラーがある場合はコミットがブロックされる。

---

## 5. デバッグ方法

### 5.1 CLI のデバッグ

ソース直接実行で十分。Bun のデバッガを使う場合:

```bash
bun --inspect src/cli.ts <subcommand>
```

`chrome://inspect` または VS Code の "Attach to Bun" 構成で接続する。

### 5.2 MCP サーバーのデバッグ

#### a) デバッグログを有効化して起動

```bash
bun run mcp -- --debug
```

stdio で待機するため、エージェント (Claude Code / Codex / Gemini CLI / Kiro) から接続して動作確認する。

#### b) MCP Inspector (GUI) で対話的に検査

```bash
npx @modelcontextprotocol/inspector
```

接続フォームは以下のように設定する (詳細は [`DEVELOPMENT.md`](../DEVELOPMENT.md#testing-with-mcp-inspector) 参照):

- Transport: **STDIO**
- Command: `bun`
- Arguments (1 項目ずつ入力):
  - `--cwd`
  - `<本リポジトリの絶対パス>`
  - `src/cli.ts`
  - `mcp`
  - `start`

> `bun run mcp` を直接渡すと Bun の `$ bun …` プリアンブルが JSON parse を壊すため、Inspector からは `src/cli.ts mcp start` を呼ぶか、`bun run --silent mcp` を使う。

#### c) MCP Inspector (CLI) でスクリプト的に検査

```bash
npx @modelcontextprotocol/inspector-cli \
  --cli \
  --transport stdio \
  --method tools/list \
  -- bun --cwd <本リポジトリの絶対パス> src/cli.ts mcp start
```

#### d) Claude Code 等のエージェントから接続

```bash
# 開発用のサーバーを登録 (.mcp.json が作られる)
claude mcp add backlog-dev -- bun run mcp
```

ツール変更 → サーバー再起動 (`Ctrl+C` → 再実行) → エージェント側の再接続、というループで反復する。

### 5.3 Web UI のデバッグ

```bash
# CSS をビルドしてから browser サブコマンドを起動
bun run cli -- browser            # 既定ポート 6420
bun run cli -- browser --port 8080
bun run cli -- browser --no-open  # ブラウザ自動起動を抑制
```

React 部分の開発時は `bun run build:css` を別ターミナルで監視実行するか、必要に応じて再実行する。

### 5.4 設定値の確認

```bash
bun run cli -- config list
bun run cli -- config get <key>
bun run cli -- config set <key> <value>
```

---

## 6. リリースビルドの動作確認

```bash
bun run build
./dist/backlog --help
./dist/backlog task list
./dist/backlog mcp start
```

クロスプラットフォームのリリースは GitHub Actions (`Release multi-platform executables` workflow) と npm Trusted Publishing で行う。手元では行わない。詳細は [`DEVELOPMENT.md` の Release 節](../DEVELOPMENT.md#release) 参照。

---

## 7. Git タグの命名規則 (重要)

### 7.1 リリースワークフローのトリガー

タグ push に反応するワークフローは `.github/workflows/release.yml` のみで、トリガーは次の 1 行である。

```yaml
on:
  push:
    tags: ['v*.*.*']
```

すなわち、**`v` で始まり、中にドットを 2 個以上含むタグ** がリリースを起動する (例: `v1.2.3`, `v0.0.1`, `v1.2.3-rc1`)。
CI 用の `.github/workflows/ci.yml` と `.github/workflows/shai-hulud-check.yml` はタグでは起動しない (`branches: [main]` と `pull_request` のみ)。

### 7.2 起動時の副作用

`v*.*.*` 形式のタグを push すると、ワークフロー内で以下が連鎖的に実行される。

- タグから先頭 `v` を剥がした値を `package.json` の `version` に書き換える。
- `backlog.md` および `backlog.md-<os>-<arch>` の platform packages を npm publish する。
- GitHub Release を作成し、各プラットフォーム向けバイナリを添付する。
- `main` ブランチに `chore: sync package.json version to <tag> [skip ci]` のコミットを `stefanzweifel/git-auto-commit-action` で自動 push する。

本 Fork (ambr-tech) には upstream 用の npm Trusted Publishing 権限が無いため、`v*.*.*` タグを誤って push すると、**publish は失敗するが `main` への強制コミットなど一部の副作用は走る**。事故の影響が大きいので、SemVer 形式のタグは利用しない。

### 7.3 安全な命名パターン

`v*.*.*` glob に一致しない名前を使う。推奨は **先頭に Fork 識別プレフィックスを付ける** 形式である。

| 種類 | 例 | 反応有無 |
|------|------|----------|
| `v` で始まらない | `fork-v1.2.3`, `ambr-v1.2.3`, `release-1.2.3` | ❌ 反応しない (安全) |
| `v` で始まるがドット 1 個以下 | `v1`, `v2026-05-22` | ❌ 反応しない (安全) |
| `v` で始まりドット 2 個以上 | `v1.2.3`, `v0.0.1-fork` | ✅ 反応する (**危険**) |

推奨命名: `fork-vX.Y.Z` または `ambr-vX.Y.Z`。可読性と検索性が両立し、`v*.*.*` には絶対に一致しない。

### 7.4 Fork 独自リリースを動かしたくなった場合

将来 Fork 専用のリリースフローを動かしたい場合は、`release.yml` の trigger を Fork 向けに変える (例: `tags: ['fork-v*.*.*']`) か、`release.yml` 自体を Fork では無効化する。upstream マージとの衝突を避けるため、必ず `[Custom]` マーカーコメントを付けて変更する。

---

## 8. Fork 運用ルール (要点)

詳細は [`FORK_NOTES.md`](../FORK_NOTES.md) を参照。要点のみ:

- upstream のファイル変更は最小限とし、新規ファイルは `custom/` 配下に置く。
- 既存ファイルを変更する場合はマーカーコメント (`// [Custom] 理由`, `// [Custom:start] … // [Custom:end]`) を付ける。
- コミットメッセージの冒頭に `[Custom] ` を付与する。
- 作業ブランチは `feature/` プレフィックス。upstream 由来の `tasks/back-xxx-…` とは混在させない。
- `custom/` 配下のコメント・コミット本文・ドキュメントは日本語で記述する (識別子は英語のまま)。

---

## 9. トラブルシューティング

| 症状 | 対処 |
|------|------|
| `backlog browser` で CPU が張り付く | Bun が 1.3.x になっていないか確認。`bun --version` で 1.2.23 に揃える。 |
| MCP Inspector で接続が切れる / JSON parse エラー | `bun run mcp` 直叩きを避け、`src/cli.ts mcp start` か `bun run --silent mcp` を使う。 |
| Windows でテストが timeout する | `bunfig.toml` の `timeout` を確認。10s で不足する個別テストはローカルでのみ延ばす。 |
| pre-commit で Biome が失敗する | `bun run check` で内容を確認し、`bun run lint` / `bun run format` で修正してから再コミット。 |
| `postinstall` の `bun2nix` でエラー | Nix 未導入なら無視可。コマンドは失敗しても `|| true` で握り潰される。 |

---

## 10. 参考リンク

- [`README.md`](../README.md) — ユーザー向け概要
- [`DEVELOPMENT.md`](../DEVELOPMENT.md) — 開発・MCP・リリース手順 (upstream)
- [`CLI-INSTRUCTIONS.md`](../CLI-INSTRUCTIONS.md) — CLI コマンドリファレンス
- [`ADVANCED-CONFIG.md`](../ADVANCED-CONFIG.md) — 設定キー一覧
- [`AGENTS.md`](../AGENTS.md) — AI エージェント向けガイドライン
- [`CONTRIBUTING.md`](../CONTRIBUTING.md) — コントリビュート手順
- [`FORK_NOTES.md`](../FORK_NOTES.md) — 本 Fork の運用ルール
