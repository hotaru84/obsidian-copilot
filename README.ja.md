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

GitHub CopilotをObsidianで直接チャット。Agent Client Protocol（ACP）を使ってAIアシスタントをVault内で利用できます。

[Agent Client Protocol (ACP)](https://github.com/zed-industries/agent-client-protocol) by Zed を基に構築。

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
- **WSLサポート**: Windows Subsystem for Linux内でCopilot CLIを実行（Windowsのみ）
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
2. `VaultFolder/.obsidian/plugins/obsidian-copilot/` に配置
3. **設定 → コミュニティプラグイン** でプラグインを有効化

## クイックスタート

GitHub Copilotは Agent Client Protocol をネイティブにサポートしているため、セットアップは簡単です。

1. **GitHub Copilot CLIをインストール**:
   ```bash
   npm install -g @github/copilot-cli
   ```

2. **認証**:
   ```bash
   copilot auth login
   ```
   ブラウザの指示に従いGitHubで認証します。

3. **パスを確認**:
   ```bash
   which copilot    # macOS/Linux
   where.exe copilot # Windows
   ```

4. **設定 → Copilot for Obsidian** で設定:
   - **GitHub Copilot CLI path**: 例: `/usr/local/bin/copilot`（Windowsは `C:\path\to\copilot.exe`）
   - **Node.js path**: （任意）Node.jsがPATHにない場合に指定

5. **チャット開始**: リボンのロボットアイコンをクリック（またはキーボードショートカットを使用）

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
