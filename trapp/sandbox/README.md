# New UI Sandbox

既存の本番ページから独立したデザイン検証用ページです。

- エントリーポイント: `sandbox/index.html`
- 既存の `index.html` / `style.css` / `script.js` は変更しません。
- 既存データは読み取り専用で参照します。
- Service Worker と PWA manifest は登録しません。
- 観戦予定の試用データは `takarei_sandbox_` 接頭辞の別キーに保存します。

ローカルサーバーでプロジェクトルートを配信し、`/sandbox/` を開いて確認してください。
