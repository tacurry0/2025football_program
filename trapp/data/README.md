# Data Layout

このフォルダは、アプリが参照する静的データと共有アセットの置き場所です。

## Active Data

- `schedule/2026.json`
  - ホーム画面、日程一覧、カレンダーの初期日程。
  - 参照元: `schedule/schedule.js`, `script.js`

- `history/niigata/{year}.json`
  - アルビレックス新潟の年別公式記録。
  - 日程詳細、大型ビジョンの試合選択、スタメン/ベンチ、審判/結果/警告の元データ。
  - 参照元: `script.js`, `vision/app.js`

- `history/kumamoto/{year}.json`
  - ロアッソ熊本の年別公式記録。
  - 日程詳細、結果補完の元データ。大型ビジョンでは使用しない。
  - 参照元: `script.js`

- `results/results.json`
  - GAS結果取得が失敗した場合のローカルfallback。
  - 参照元: `script.js`

- `standings/current.json`
  - GAS順位表取得が失敗した場合、またはGAS順位表に新潟/熊本がない場合のローカルfallback。
  - 参照元: `script.js`

- `clubs/club_emblems.json`
  - クラブ名からエンブレム画像への対応表。
  - 画像パスは `data/assets/emblems/...` に統一。
  - 参照元: `script.js`, `vision/app.js`

- `clubs/official_sites.json`
  - クラブ公式サイトリンク。
  - 参照元: `script.js`

## Active Assets

- `assets/emblems/`
  - メイン画面、日程詳細、大型ビジョンで使うクラブエンブレム。

- `assets/icons/`
  - PWAアイコン、リーグロゴ、大型ビジョンのadidas画像など。

- `assets/fonts/`
  - メイン画面と大型ビジョンで共通利用するフォント。

- `assets/vision/`
  - 大型ビジョン専用の背景画像。

## Old Data

- `old/`
  - 現在の参照元からは読まない旧データ、重複データ、検証用データ。
