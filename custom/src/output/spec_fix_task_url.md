# タスク URL 機能 不具合修正仕様

## 1. 不具合概要

Kanban Board / All Tasks / Milestones いずれのページでも、タスク一覧のタスクをクリックするとタスク詳細モーダルが一瞬開いた後に閉じ、画面が All Tasks (TaskList) に遷移してしまう。

期待する挙動: モーダルが開いたまま、 URL のみ `/tasks/<taskId>` に切り替わる。

## 2. 原因

ブラウザコンソールの `[TaskUrlSync]` プレフィックス付きログから、以下 2 つのバグが連鎖していることが判明した。

### バグ 1 (致命的): タスク ID プレフィックスを `task-` で決め打ちした

実装ファイル: `custom/src/task-url-routing/taskUrlPath.ts`

```ts
const TASK_PATH_PATTERN = /^\/tasks\/(task-[A-Za-z0-9_-]+)\/?$/;
```

正規表現が `task-` 始まりの ID のみを受け付ける。本プロジェクトの実環境では `BACK-217` のように `BACK-` プレフィックスを採用しているため、`parseTaskPath('/tasks/BACK-217')` が `null` を返してしまう。

サーバー側 (`src/server/index.ts:25-27`) の `DEFAULT_PREFIX="task-"` はデフォルト値であり、`backlog/config.yml` 等で変更可能な設定値。URL 解析側で固定するのは設計ミス。

該当ログ:

```
effect:URL->state fire {pathname: '/tasks/BACK-217', urlTaskId: null, ...}
                                                     ^^^^^^^^^^^^^^^
```

### バグ 2 (設計): URL→state の useEffect が state 変化でも発火する

実装ファイル: `custom/src/task-url-routing/TaskUrlSync.tsx`

URL→state の `useEffect` の依存配列に `editingTask`, `showModal` を含めたため、ユーザークリック直後の **state は更新済み・URL はまだ更新前 (`/`)** という瞬間にもこの effect が発火し、「URL に taskId が無いのにモーダルが開いている → 閉じる」と誤判定して `onCloseTask()` を呼ぶ。

該当ログ:

```
effect:URL->state fire {pathname: '/',            ← URL はまだ /
                        editingTaskId: 'BACK-217',  ← state は更新済み
                        showModal: true}
effect:URL->state -> onCloseTask (URL has no taskId but modal open) ← 誤発火
```

### 不具合の連鎖

| # | 出来事 | state | URL | 結果 |
|---|---|---|---|---|
| 1 | クリック → `handleEditTask(BACK-217)` | `showModal=true, editingTask=BACK-217` | `/` | — |
| 2 | URL→state effect 発火 (editingTask 変化が trigger) | 同上 | `/` | **バグ 2: 誤って `onCloseTask` 呼ぶ** |
| 3 | state→URL effect 発火 | 同上 | `/` | `navigate('/tasks/BACK-217')` |
| 4 | レンダリング (step 2 の閉じる反映) | `showModal=false, editingTask=null` | `/` | モーダル消える |
| 5 | URL 変化が反映 | 同上 | `/tasks/BACK-217` | `parseTaskPath` が **バグ 1** で null 返し、何もしない |
| 6 | Routes が `/tasks/:taskId` にマッチ | — | `/tasks/BACK-217` | TaskList が表示される |

ユーザーが目撃した「一瞬開いて All Tasks へ遷移」は step 4 + step 6 の見た目。

## 3. 修正方針

### 修正 A: プレフィックス非依存にする

ファイル: `custom/src/task-url-routing/taskUrlPath.ts`

- `TASK_PATH_PATTERN` を「1 セグメント (URL 区切り文字を含まない) 全般」を受け入れる形に緩める。
- 任意のプレフィックス (`task-`, `BACK-`, etc.) を扱えるようにする。

変更前:
```ts
const TASK_PATH_PATTERN = /^\/tasks\/(task-[A-Za-z0-9_-]+)\/?$/;
```

変更後:
```ts
const TASK_PATH_PATTERN = /^\/tasks\/([^/?#]+)\/?$/;
```

`/`, `?`, `#` を含まない 1 セグメントを `taskId` として抽出する。URL 検証はサーバー側/タスクリスト側の find に委ね、URL レイヤは「セグメント取り出し」のみ責任を持つ。

### 修正 B: URL→state effect の発火条件を URL 変化のみに絞る

ファイル: `custom/src/task-url-routing/TaskUrlSync.tsx`

- URL→state の `useEffect` の **依存配列から `editingTask`, `showModal` を外す**。
- effect 内でこれらの値を参照するため、ref に最新値を保存し、closure 経由で参照する (stale closure を避ける)。

実装イメージ:

```ts
const editingTaskRef = useRef(editingTask);
const showModalRef = useRef(showModal);
useEffect(() => {
    editingTaskRef.current = editingTask;
    showModalRef.current = showModal;
});

// URL -> state: pathname 変化時のみ発火
useEffect(() => {
    const urlTaskId = parseTaskPath(location.pathname);
    if (urlTaskId) {
        if (lastSyncedTaskIdRef.current === urlTaskId) return;
        if (editingTaskRef.current?.id === urlTaskId && showModalRef.current) {
            lastSyncedTaskIdRef.current = urlTaskId;
            return;
        }
        const task = tasks.find((t) => t.id === urlTaskId);
        if (task) {
            lastSyncedTaskIdRef.current = urlTaskId;
            onOpenTask(task);
        }
        return;
    }
    if (showModalRef.current && editingTaskRef.current) {
        lastSyncedTaskIdRef.current = null;
        onCloseTask(); // 戻るボタン等で URL に taskId が無くなった時のみ
    } else {
        lastSyncedTaskIdRef.current = null;
    }
}, [location.pathname, tasks, isLoading, onOpenTask, onCloseTask]);
// ↑ editingTask, showModal を依存配列から外す
```

これにより:
- ユーザークリック → `editingTask` が変わっても URL→state effect は発火しない。
- state→URL effect が `navigate('/tasks/BACK-217')` を実行。
- URL が変化したことで URL→state effect が発火し、`lastSyncedTaskIdRef === urlTaskId` の skip 分岐に入り何もしない。
- 戻るボタンで URL から taskId が消えた場合のみ、`onCloseTask` が呼ばれる。

state→URL effect 側は変更不要 (もともと `showModal`, `editingTask` 変化で発火するのが正しい)。

## 4. テスト追加

ファイル: `custom/tests/task-url-routing/taskUrlPath.test.ts`

`parseTaskPath` / `buildTaskPath` / `isTaskPath` に対し、`task-` 以外のプレフィックスを通すケースを追加:

```ts
test.each([
    ["/tasks/BACK-217", "BACK-217"],
    ["/tasks/PROJ-1", "PROJ-1"],
    ["/tasks/123", "123"],
    ["/tasks/task-001", "task-001"], // 後方互換
])("parseTaskPath(%p) === %p", (input, expected) => {
    expect(parseTaskPath(input)).toBe(expected);
});
```

`isTaskPath` も同様に拡張。

## 5. 検証手順

1. `bunx tsc --noEmit` でエラーが無いこと。
2. `bun test custom/tests/task-url-routing` が全件 PASS すること (追加ケース含む)。
3. `bun run cli browser` で起動し、以下を確認:
   - **Kanban Board (`/`)** でタスクをクリック → モーダルが開いたまま URL が `/tasks/<id>` に変化。画面遷移しない。
   - **All Tasks (`/tasks`)** でタスクをクリック → モーダルが開いたまま URL が `/tasks/<id>?...` に変化。フィルタクエリが保持される。
   - **Milestones (`/milestones`)** でタスクをクリック → モーダルが開いたまま URL が `/tasks/<id>` に変化。画面遷移しない (現在は Routes が TaskList にマッチするため Milestones ベース表示は維持されない — 残課題)。
   - モーダルを閉じる → 元の URL に戻る。
   - ブラウザ戻るボタン → モーダルが閉じる。
4. コンソールログ (`[TaskUrlSync]`) で、クリック時の流れが以下となること:
   - `effect:state->URL fire` (showModal=true)
   - `effect:state->URL navigate(push) {from: '/', to: '/tasks/<id>'}`
   - `effect:URL->state fire` (pathname=/tasks/<id>, urlTaskId=<id>)
   - `effect:URL->state skip (already synced)`
   - `onCloseTask` は **呼ばれない** こと。

## 6. 残課題 (今回の修正対象外)

URL `/tasks/<id>` への直接アクセス時 (および他画面からのクリック後) は、Routes 設計上 `<Route path="tasks/:taskId" element={<TaskList ... />}/>` がマッチするため、必ず TaskList をベースとした画面構成になる。

「クリックした画面 (Board / Milestones) をベースに保ち、モーダルだけ重ねる」挙動が求められる場合は、以下の追加対応が必要 (今回スコープ外):

- 案 1: Route を `path="tasks/:taskId"` から分離せず、各ベース画面のルートに `:taskId?` を二重マッピング。
- 案 2: URL を `/tasks/<id>` 単独ではなく、ベース画面のクエリ (`/?task=<id>`, `/milestones?task=<id>` 等) として表現。
- 案 3: `sessionStorage` で直前画面を保持し、モーダルを閉じた際に元画面へ戻す。

修正 A+B 適用後にユーザーの実体験をふまえて選定する。

## 7. ログの取扱い

調査用に追加した `[TaskUrlSync]` プレフィックスのログは、修正後の動作確認まで残し、確認が完了したら `LOG_ENABLED = false` に切り替える、または該当行を削除する。

ログ実装箇所: `custom/src/task-url-routing/TaskUrlSync.tsx` 冒頭の `LOG_ENABLED` 定数。
