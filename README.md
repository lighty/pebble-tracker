# Pebble Tracker

Pebble Tracker は Obsidian 向けのイベント記録プラグインです。ユーザーが任意のイベントを定義し、スマートフォンで素早く記録し、あとから日別・週別・月別の集計で振り返ることを目的としています。

## 現在の実装範囲

- 専用タブでの記録画面
- GUI でのイベント追加・編集・削除
- メモ付きイベント記録
- 日別・週別・月別の棒グラフと一覧
- 記録レコードの CSV 保存

## ファイル構成

- [manifest.json](/Users/lighty/ghq/github.com/lighty/pebble-tracker/manifest.json): Obsidian プラグイン定義
- [main.js](/Users/lighty/ghq/github.com/lighty/pebble-tracker/main.js): プラグイン本体
- [styles.css](/Users/lighty/ghq/github.com/lighty/pebble-tracker/styles.css): 画面スタイル
- [docs/mvp-spec.md](/Users/lighty/ghq/github.com/lighty/pebble-tracker/docs/mvp-spec.md): MVP 仕様
- [docs/technical-design.md](/Users/lighty/ghq/github.com/lighty/pebble-tracker/docs/technical-design.md): 技術設計メモ

## 保存データ

- イベント定義と選択中イベントは Obsidian の plugin data に保存します
- 記録レコードは Vault 内の `PebbleTracker/records.csv.md` に保存します

CSV ヘッダー:

```csv
id,eventTypeId,timestamp,memo
```

## ローカル確認

ビルドツールはまだ導入していないため、現状の最低限の確認は以下です。

```bash
node --check main.js
```
