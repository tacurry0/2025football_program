# Full Clone Sandbox

元アプリをそのまま読み込み、見た目だけをサンドボックス専用CSSで上書きする検証ページです。

- 元の `index.html`、`schedule/schedule.js`、`script.js` を実行
- トップ画面、全メニュー、全フィルター、過去選手・過去結果をそのまま維持
- `pwa.js` と manifest は読み込まず、Service Workerを登録しない
- 元スクリプト内の `localStorage` 参照だけをサンドボックス専用領域へ差し替え
- 本番ファイルは変更しない

デザイン変更は `sandbox/sandbox-theme.css` のみで行います。
