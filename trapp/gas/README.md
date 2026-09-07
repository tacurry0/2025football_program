# J2/J3 data service (2026/27)

`JLeague.gs` が貼り替え用GAS全文。Apps ScriptのV8ランタイムで実行する。

## 導入

1. 既存GASの取得コードを `JLeague.gs` 全文で置き換える。同名の `doGet` や `test` を別ファイルに残さない。
2. 保存後、関数 `test` を実行し、必要な権限を許可する。J2/J3 × standings/resultsの4件が `status:200`, `stale:false` になれば取得成功。
3. 「デプロイ」→「デプロイを管理」→既存Webアプリの編集→バージョン「新バージョン」→デプロイ。実行ユーザー・公開範囲は既存のブラウザから匿名取得できる設定を引き継ぐ。
4. 同じデプロイを更新するとURLが維持されるため、アプリ側のURL変更は不要。別デプロイにした場合は `../league-data.js` の `GAS_URL` も変更する。
5. アプリを再読み込みし、順位表の「更新」を押す。J2/J3各20クラブ、引き分け列、取得日時を確認する。

Google公式: https://developers.google.com/apps-script/concepts/deployments#edit_a_versioned_deployment

保存だけでは既存Webアプリに反映されない。GitHubへの更新とGASのデプロイは別の作業。

## API

`GET {既存execURL}?type=standings&league=j2&season=2026_2027`

- `type`: `standings` / `results`
- `league`: `j2` / `j3`（旧 `all`, `playoff` はサポートしない）
- `season`: `2026_2027`。省略時も同シーズン。
- `nocache=1`: 明示的な更新時だけ指定。通常は30分キャッシュ。

JSONの `status` を判定する（ContentServiceの実HTTPステータスではない）。成功は `schemaVersion:2`, `status:200`, `season`, `league`, `fetchedAt`, `stale`, `complete:true`, `data`。公式取得失敗時は前回正常データを元の取得日時のまま `stale:true` で返す。正常データがなければ `status:503`, `data:[]`。引数不正は400。

順位表は各20クラブ、チームID重複・数値・勝敗内訳・得失点差・シーズン一致を検証。結果は試合ID、日付、リーグ、大会、節、ホーム/アウェイ、得点、状態を持つ。未終了試合の得点は `null`、0–0は数値0。PK勝敗を通常リーグの引き分けに持ち込まない。

## 取得方式

公式の `/{league}/standings/?year=2026-27` と `/{league}/match/?startdate=...&enddate=...&category=...` を使用する。新しいページ内のNext Flight JSONを参照解決して読む。取得したJavaScriptは実行しない。リーグページに混在するカップ戦は公式試合URLのリーグ識別で除外する。

2026年8月から当日まで月別に取得し、3リクエストずつ処理。初回は経過月全部、2回目以降は当月・前月・未終了試合のある月・過去月の持ち回り再確認を取得する。月別結果を試合IDで更新し、完了済み試合の突然の欠落はエラー扱いにする。過去の得点訂正も再確認で反映する。

正常データはgzip/base64で圧縮し、Script Propertiesへ7000文字ずつ分割保存。短期Cacheにも保存する。`clearCache()` は短期キャッシュのみ削除し、正常データのバックアップを残す。

現在は2026/27専用。次季対応時はGASの `JL`、クライアントの `SEASON`、日程と静的データのパスを一緒に更新する。公式サイトの内部構造が再変更された場合は正常データの表示を継続し、パーサーの修正が必要。

## アプリ移行と履歴

`league-data.js` は大会識別と検証・GAS接続を共通化。`league-ui.js` はJ2/J3タブと百年構想保存分の表示を担当する。日程と大型ビジョンも同じ大会識別を使う。

キャッシュは `trapp_v2_{season}_{league}_{type}` に分離。旧キーを消さず、観戦・メモ・スコアの `date_club_opponent` 識別子も維持する。旧結果は2〜6月の百年構想履歴として扱い、現行J2/J3の取得結果に混在させない。

同梱データは2026年9月7日取得時点。J2は50試合、J3は49試合。静的JSONが自動更新される仕組みではなく、通常更新はGAS経由。更新に失敗した場合は保存日時と保存データであることを表示する。百年構想順位表の保存分は4月17日時点で、最終順位ではない。

## 検証

依存パッケージ不要、Node.js 18以上:

```sh
node --test trapp/tests/leagues.test.cjs
```

公式HTMLによる追加検証:

```sh
TRAPP_FIXTURES=/path/to/official-html node --test trapp/tests/leagues.test.cjs
```

必要ファイル名は `trapp-j2-standings.html`, `trapp-j2-august.html`, `trapp-j2-september.html` と同じJ3版。2026年9月7日の取得内容に対する初期移行検証で、J2の50試合/J3の49試合および各クラブの勝敗・得点を検証する。HTMLをリポジトリには同梱していない。

`data/scripts/build_league_snapshots.cjs` は同じ6ファイルから初期移行用のデータ一式を生成する補助スクリプト（ファイル内容マップを標準出力する）。定期更新用ではない。

Apps ScriptサービスはNodeテストでモックしている。実際のGoogle環境での権限・通信・実行時間は導入時の `test` で確認する。
