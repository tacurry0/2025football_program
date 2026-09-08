# Data Layout

このフォルダは、アプリが参照する静的データと共有アセットの置き場所です。

## Active Data

- `schedule/2026_2027.json`
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
  - 百年構想リーグの取得済み結果。2026年2〜6月分を履歴として読む。
  - 参照元: `script.js`

- `results/2026_2027/{j2,j3,leaguecup,emperor}.json`
  - J2/J3別の正常取得済み結果。GAS更新前・通信失敗・オフライン時にも表示可能。
  - 参照元: `league-data.js`, `script.js`

- `details/2026_2027/{league}/{match_id}.json`
  - 公式試合詳細の正常取得済みデータ。先発・控え・交代・得点・審判などを保持。
  - 試合を開くとGASから更新し、失敗時は取得済みデータを表示。
  - 参照元: `league-data.js`, `script.js`

- `standings/2026_2027/{j2,j3}.json`
  - J2/J3それぞれ20クラブの順位表。各ファイルに実際の取得日時と公式更新日を保持。
  - 参照元: `league-data.js`, `script.js`

- `standings/archive/2026_hundred.json`
  - 2026年4月17日に取得した百年構想リーグの保存分。最終順位ではない。
  - 参照元: `league-ui.js`

- `standings/current.json`
  - 現行J2/J3の統合スナップショット。互換参照用。新しい画面はリーグ別ファイルを読む。

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

## League data service

GASの導入・取得仕様・検証手順は `../gas/README.md` を参照。
