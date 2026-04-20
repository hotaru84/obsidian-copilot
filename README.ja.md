<h1 align="center">Copilot for Obsidian</h1>

<p align="center">
  <img src="https://img.shields.io/github/downloads/hotaru84/obsidian-copilot/total" alt="GitHub Downloads">
  <img src="https://img.shields.io/github/license/hotaru84/obsidian-copilot" alt="License">
  <img src="https://img.shields.io/github/v/release/hotaru84/obsidian-copilot" alt="GitHub release">
  <img src="https://img.shields.io/github/last-commit/hotaru84/obsidian-copilot" alt="GitHub last commit">
</p>

<p align="center">
  <a href="README.md">English</a>
</p>

GitHub CopilotをObsidianで直接チャット。組み込みのremote runtime SDKでVault内にAIアシスタントを統合します。

https://github.com/user-attachments/assets/1c538349-b3fb-44dd-a163-7331cbca7824

## 機能

- **ノートメンション**: `@ノート名`でノートを参照
- **選択テキストのコンテキスト**: 選択中のテキストをエージェントへ自動送信
- **画像添付**: チャットに画像をペーストまたはドラッグ&ドロップ
- **スラッシュコマンド**: GitHub Copilotが提供する`/`コマンドを使用
- **マルチセッション**: 複数のチャットセッションを別々のビューで同時実行
- **ブロードキャスト**: すべてのチャットビューに一括でメッセージを送信
- **フローティングチャット**: 素早くアクセスできる折りたたみ可能なチャットウィンドウ
- **モード・モデル切り替え**: チャット画面からCopilotのモードとモデルを変更
- **セッション履歴**: 過去の会話を再開またはフォーク
- **チャットエクスポート**: 会話をMarkdownノートとして保存
- **スケジュールプロンプト**: 時間帯を指定して定期実行するプロンプトを設定
- **ターミナル統合**: Copilotがコマンドを実行し結果を返す
- **MCPツール表示**: Model Context Protocolのツール呼び出しをチャット内でインライン表示
- **入力履歴**: ↑/↓キーで過去のメッセージを呼び出し
- **自動許可**: エージェントのパーミッションリクエストを自動承認するオプション
- **表示カスタマイズ**: フォントサイズ、絵文字表示、差分の折りたたみを調整

## インストール

### BRAT経由（推奨）

1. [BRAT](https://github.com/TfTHacker/obsidian42-brat) プラグインをインストール
2. **設定 → BRAT → Add Beta Plugin** に移動
3. 貼り付け: `https://github.com/hotaru84/obsidian-copilot`
4. プラグインリストから **Copilot for Obsidian** を有効化

### 手動インストール

1. [リリース](https://github.com/hotaru84/obsidian-copilot/releases)から `main.js`、`manifest.json`、`styles.css` をダウンロード
2. `VaultFolder/.obsidian/plugins/obsidian-copilot-agent/` に配置
3. **設定 → コミュニティプラグイン** でプラグインを有効化

## クイックスタート

1. **設定 → Copilot for Obsidian → Runtime** を開く
2. **Bundled server**（推奨）または **External server** を選ぶ
3. 必要に応じてポート/URL・タイムアウトを調整
4. 必要に応じて **Enable MCP config discovery** と **MCP servers JSON** を設定
5. リボンのロボットアイコンからチャット開始

## 変更履歴

### バグ修正

#### Web fetchツールコールがpendingのまま進まない問題

**症状**: エージェントがWeb fetchを実行すると、ツールコールが `pending` 状態のまま
進捗せず、権限承認ボタンが表示されない。操作をキャンセルすると
`Cancelling 1 pending permission requests` とコンソールに出力されるが、
UI上では権限リクエスト自体が一度も表示されていない状態になる。

**根本原因**（3つの問題が複合）:

1. **プロンプト間でパーミッションキューが残留する** — `pendingPermissionQueue` は
   明示的なキャンセル時にしかクリアされなかった。直前のプロンプトがエラー等で
   権限リクエストを解決せずに終了すると、残留エントリにより次の
   `requestPermission` 呼び出しが `isActive: false` を発行し、承認ボタンが
   非表示になっていた。

2. **`tool_call_update` でのステータス逆行** — runtime の `ToolCallUpdate.status` は
   nullable（`null` = 「変更なし」）だが、アダプターが `status || "pending"` で
   `null` を `"pending"` に変換していた。すでに `in_progress` 状態のツールコールが
   `pending` に逆行するケースが発生していた。

3. **mergeロジックにステータス前進のみ保護がない** — `mergeToolCallContent` が
   受け取ったステータスをそのまま適用するため、上記の逆行を防げなかった。

**修正内容**:
- `resetCurrentMessage()` が各プロンプト開始前に stale なパーミッションキューを
  クリアするようになり、残留エントリが次のパーミッションUIを抑制しなくなった。
- `sessionUpdate()` ハンドラーで `tool_call` と `tool_call_update` を分離。
  更新時は `status ?? undefined` を使用し、ACP の `null` を「変更なし」として
  正しく扱うようにした。
- `mergeToolCallContent` にステータス前進のみ保護を追加
  （`pending → in_progress → completed/failed` の順序を強制）。
  アダプターが誤ったステータスを発行しても逆行しないようになった。

## 開発

```bash
npm install
npm run dev
```

プロダクションビルド:
```bash
npm run build
```

## ライセンス

Apache License 2.0 - 詳細は [LICENSE](LICENSE) を参照。

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=hotaru84/obsidian-copilot&type=Date)](https://www.star-history.com/#hotaru84/obsidian-copilot&Date)
