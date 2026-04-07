# Pebble Tracker 技術設計メモ

## 前提

この文書は [`docs/mvp-spec.md`](/Users/lighty/ghq/github.com/lighty/pebble-tracker/docs/mvp-spec.md) を実装に落とすための技術設計メモである。MVP では Obsidian プラグインとして最小限の責務分離を行い、スマートフォンでの記録体験を優先する。

## 想定ディレクトリ構成

```text
src/
  main.ts
  types.ts
  store.ts
  views/
    tracker-view.ts
    stats-view.ts
  ui/
    event-picker-modal.ts
    event-form-modal.ts
    confirm-delete-modal.ts
  services/
    stats-service.ts
```

MVP の段階ではファイル数を増やしすぎず、以下の責務で分割する。

- `main.ts`: プラグイン初期化、コマンド登録、リボン登録、ビュー登録
- `types.ts`: 永続化データと UI モデルの型定義
- `store.ts`: Vault 内の settings JSON と CSV レコード管理
- `views/tracker-view.ts`: 主画面である記録画面
- `views/stats-view.ts`: 集計画面
- `ui/*.ts`: モーダルや確認ダイアログ
- `services/stats-service.ts`: 日別・週別・月別集計などの純粋ロジック

## 型定義案

```ts
export interface EventType {
  id: string;
  name: string;
  icon: string;
  color: string;
  allowMemo: boolean;
  createdAt: string;
}

export interface EventRecord {
  id: string;
  eventTypeId: string;
  timestamp: string;
  memo?: string;
}

export interface PebbleTrackerData {
  eventTypes: EventType[];
  selectedEventTypeId: string | null;
}
```

### 補足

- `createdAt` は作成順の安定表示に使う
- `selectedEventTypeId` は前回選択イベント復元に使う
- `timestamp` は ISO 8601 文字列で保存する
- イベント定義と選択状態は `PebbleTracker/settings.json` に保存する
- `EventRecord` は `PebbleTracker/records.csv.md` に保存する

## メインフロー

### 起動時

1. `PebbleTracker/settings.json` を読み込む
2. `PebbleTracker/records.csv.md` を読み込む
3. データが未初期化なら空データを生成する
4. ビューを登録する
5. コマンド `Open Pebble Tracker` を登録する
6. リボンアイコンを登録する

### 記録画面を開く

1. 専用タブを開く
2. `selectedEventTypeId` があればそのイベントを表示する
3. ない場合は最初のイベントを選ぶ
4. イベントが 1 件もない場合はイベント作成導線を表示する

### 記録する

1. 選択中イベントを確認する
2. メモ欄の値を読む
3. 新しい `EventRecord` を生成する
4. `PebbleTracker/records.csv.md` に保存する
5. メモ欄をクリアする
6. 記録一覧と集計を再描画する
7. 通知を表示する

### イベントを切り替える

1. イベント選択 UI を開く
2. ユーザーがイベントを選ぶ
3. `selectedEventTypeId` を更新して保存する
4. 記録画面を再描画する

### イベントを削除する

1. 削除確認ダイアログを表示する
2. 確認後、その `eventTypeId` に紐づく records を CSV から削除する
3. eventTypes から対象を削除する
4. 削除後の選択イベントを再決定する
5. settings JSON と CSV を保存する
6. 画面を再描画する

## Store API 案

```ts
class PebbleTrackerStore {
  load(): Promise<PebbleTrackerData>;
  getData(): PebbleTrackerData;
  createEventType(input: CreateEventTypeInput): Promise<EventType>;
  updateEventType(id: string, patch: UpdateEventTypeInput): Promise<EventType>;
  deleteEventType(id: string): Promise<void>;
  setSelectedEventType(id: string | null): Promise<void>;
  createRecord(input: CreateRecordInput): Promise<EventRecord>;
  listRecordsByEventType(eventTypeId: string): EventRecord[];
  listRecentRecords(eventTypeId: string, limit: number): EventRecord[];
  loadSettingsFromVault(): Promise<PebbleTrackerData | null>;
  saveSettingsToVault(): Promise<void>;
  loadRecordsFromCsv(): Promise<EventRecord[]>;
  saveRecordsToCsv(): Promise<void>;
}
```

## 集計サービス案

集計ロジックは UI から切り離し、純粋関数または service に寄せる。

```ts
interface DailyCount {
  date: string;
  count: number;
}

function aggregateDailyCounts(
  records: EventRecord[],
  range: "7d" | "30d" | "90d" | "all",
): DailyCount[];
```

### MVP の責務

- 対象期間内のレコード抽出
- ローカル日付単位でグルーピング
- 日別件数の昇順または降順整形

## 画面ごとの責務

### TrackerView

- 現在イベントの表示
- メモ入力 UI
- 記録ボタン
- 直近記録表示
- イベント切替導線
- 集計画面への導線

### StatsView

- 対象イベント表示
- 期間切替
- 棒グラフ描画
- 日別件数表示
- 選択中期間の記録一覧表示

## UI コンポーネント案

### EventPickerModal

- イベント一覧表示
- イベント選択
- イベント追加導線
- イベント編集導線
- イベント削除導線

### EventFormModal

- 名前入力
- アイコン入力または選択
- 色入力または選択
- メモ可否切替

### ConfirmDeleteModal

- 削除確認
- 関連記録も削除される旨の表示

## 初期状態の扱い

イベントが 0 件のときは記録画面で以下を表示する。

- 空状態メッセージ
- `最初のイベントを追加` ボタン

MVP では初期プリセットを自動作成しない。ユーザーが自分で `トイレ` などのイベントを作る前提にする。

## 実装順序

1. plugin skeleton を作る
2. `types.ts` と `store.ts` を実装する
3. `TrackerView` を作る
4. イベント追加 UI を作る
5. イベント切替 UI を作る
6. 削除フローを作る
7. `StatsView` と集計ロジックを作る
8. スマホ表示を意識したスタイル調整を行う

## 未確定事項

- グラフ描画を自前 DOM/CSS で行うか、軽量ライブラリを使うか
- イベントアイコン選択を自由入力にするか、候補一覧にするか
- 集計画面を別 ViewType にするか、同一 View 内モード切替にするか

MVP 実装時は依存を増やしすぎないため、グラフはまず自前描画を優先する。

## CSV 形式

CSV は以下のヘッダーを持つ。

```csv
id,eventTypeId,timestamp,memo
```

### 補足

- `memo` は空文字を許可する
- カンマ、改行、ダブルクオートを含むメモは CSV エスケープして保存する
- 将来的な外部連携で扱いやすいよう、1 レコード 1 行の単純形式を維持する
