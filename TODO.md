# TODO

実装計画（機能追加案 1/3/4/6 + 設計改善 D-1/D-2/D-3）の残タスク一覧。
Phase 1–5 のコア実装およびビルド確認は完了済み。

---

## 設計改善

### D-1: Permission キューの直列化整理 [DONE]

**現状**: `RemoteAdapter` に `processNextPermission` ヘルパーを導入し、`handlePermissionRequest` および `respondToPermission` からの呼び出しで FIFO 直列処理を明示。

- [x] `remote.adapter.ts` の `permissionQueuesBySession` まわりを整理し、「enqueue → 未処理時のみ activate → respond → 次を activate」のフローを明示的なヘルパーにまとめる
- [x] `usePermission.ts` 側が新しいイベント順に正しく追従することを確認

---

### D-2: setRemoteAgent の reload → select 順保証 [DONE]

**現状**: `setSessionAgent` において `reloadSessionAgents` の完了を `await` し、成功時のみ内部状態と永続化情報を更新するよう改善。

- [x] `remote.adapter.ts` の `setSessionAgent` で `reload` 完了を await してから `setAgent` を呼ぶ順序を明示
- [x] 選択成功時のみ `rememberRemoteAgentSelection` を更新するロジックを追加
- [x] 失敗時に `remoteAgents` ステートを変えず UI が現状維持されることを確認（Hook 側の rollback 処理）

---

### D-3: 接続不安定時の指数バックオフ再接続 [DONE]

**現状**: `withRetryBackoff` ヘルパーを導入し、`initialize` / `newSession` / `resumeSession` / `sendPrompt` / `setSessionAgent` の各入口に 1s / 2s / 4s のリトライを適用。

- [x] `remote.adapter.ts` に `withRetryBackoff(fn, context)` ヘルパーを追加
- [x] 主要な API エントリポイントで backoff リトライを適用
- [x] リトライ全失敗時は構造化エラー（`AgentError`相当の Error）を Hook へ返却
- [x] `useAgentSession.ts` 側で受け取ったエラーを `ErrorOverlay` に表示

---

## 機能追加

### 機能 1: Elicitation レスポンス送信の結線確認 [DONE]

- [x] `useChatController.ts` の `handleSubmitElicitation` が `acpAdapter.handlePendingElicitation` を呼んでいることを確認・修正
- [x] `elicitation.completed` イベント受信後にメッセージの `status` と `response` が更新されることを確認
- [x] `ElicitationModal` の入力が正しいアクションとして送信されることを確認

---

### 機能 3: Prompt Template の slash コマンド実行 [DONE]

- [x] `useChatController.ts` で prompt 由来の slash コマンド選択時に `executePromptTemplate` を呼ぶ分岐を追加
- [x] `executePromptTemplate` において、スラッシュコマンド以降の文字列を `args` として渡すよう実装
- [x] 選択した prompt の実行結果がチャットに表示されることを確認

---

### 機能 4: History 操作 [DONE]

#### 4a: truncateHistory UI 導線

- [x] `InlineHeader` および `ChatInput` ツールメニューに「Truncate history...」項目を追加
- [x] truncate ポイントを選択（メッセージ番号入力）する UI を追加
- [x] `handleTruncateHistory()` を `useChatController.ts` に実装し `acpAdapter.truncateHistory` を呼び出す

#### 4b: compact / truncate の確認ダイアログ

- [x] `handleCompactHistory` 実行前に `window.confirm()` で確認を取る
- [x] `handleTruncateHistory` でも同様の確認を追加

#### 4c: 操作後のメッセージ再同期

- [x] `eventId` をメッセージに持たせ、truncate 実行後に `useChat.ts` の `truncateMessages(eventId)` でローカル表示を即時更新する処理を追加

---

### 機能 6: resumeSession の useAgentSession 統合 [DONE]

- [x] `useAgentSession.ts` に `restoreSession(sessionId)` メソッドを追加（`resume` 優先、不可なら `load` にフォールバックする統合パス）
- [x] `useSessionHistory.ts` の `restoreSession` 処理を新メソッドへ委譲
- [x] 失敗時のエラーハンドリングを `useAgentSession` 内に集約

---

## 未実装機能（スコープ外候補）

以下は今回の計画スコープ外だが、追加価値が高い項目として記録する。

- [ ] **使用量メトリクス表示**: `getUsageMetrics` は実装済みだが UI 表示なし
- [ ] **接続状態インジケーター**: `getConnectionState` が実装済みだが UI に反映されていない

---

## 検証チェックリスト（Phase 6）

実装完了後に実施する手動 E2E 確認項目。

- [x] `npm run build` 通過
- [ ] `npm run lint` 通過
- [ ] `npm run format:check` 通過
- [ ] Elicitation: requested → ダイアログ表示 → accept / decline / cancel 各経路
- [ ] Prompt: listPrompts 取得 → slash から executePrompt 実行
- [ ] History: compact 実行後に表示が崩れず続行送信できる
- [ ] History: truncate 実行後に表示が崩れず続行送信できる
- [ ] Resume: サーバー再起動後の同一 sessionId で resumeSession 成功
- [ ] Permission: 連続 request で FIFO 直列処理が維持される
- [ ] Reconnect: サーバー停止 → 復帰時に backoff 再接続が行われ送信再開できる
- [ ] 既存回帰: send + session_idle 完了判定が正常動作
- [ ] 既存回帰: remote agent selector 表示 / 非表示が正常
- [ ] 既存回帰: 既存 permission UI フローが壊れていない
