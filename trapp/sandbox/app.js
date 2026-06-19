(() => {
  "use strict";

  const ROOT = "../";
  const STORAGE_PREFIX = "takarei_fullclone_sandbox:";

  function replaceExternalScript(html, pattern, blobUrl) {
    return html.replace(pattern, `<script src="${blobUrl}"><\/script>`);
  }

  function rewriteRuntimePaths(source) {
    return source
      .replace(/(["'`])\.\/(data|vision)\//g, "$1../$2/")
      .replace(/(["'`])data\//g, "$1../data/")
      .replace(/(["'`])vision\//g, "$1../vision/");
  }

  function isolationBootstrapSource() {
    return `
      (() => {
        const raw = window.localStorage;
        const prefix = ${JSON.stringify(STORAGE_PREFIX)};
        const rawGet = Storage.prototype.getItem;
        const rawSet = Storage.prototype.setItem;
        const rawRemove = Storage.prototype.removeItem;
        const rawKey = Storage.prototype.key;
        const ownKeys = () => {
          const keys = [];
          for (let i = 0; i < raw.length; i += 1) {
            const key = rawKey.call(raw, i);
            if (key && key.startsWith(prefix)) keys.push(key.slice(prefix.length));
          }
          return keys;
        };
        window.__sandboxStorage = {
          get length() { return ownKeys().length; },
          key(index) { return ownKeys()[index] ?? null; },
          getItem(key) { return rawGet.call(raw, prefix + String(key)); },
          setItem(key, value) { rawSet.call(raw, prefix + String(key), String(value)); },
          removeItem(key) { rawRemove.call(raw, prefix + String(key)); },
          clear() { ownKeys().forEach(key => rawRemove.call(raw, prefix + key)); }
        };
        window.__TAKAREI_FULL_CLONE_SANDBOX__ = true;
        document.documentElement.dataset.sandboxStorage = "isolated";
      })();
    `;
  }

  async function boot() {
    try {
      const [htmlResponse, scheduleResponse, appResponse] = await Promise.all([
        fetch(`${ROOT}index.html`, { cache: "no-store" }),
        fetch(`${ROOT}schedule/schedule.js`, { cache: "no-store" }),
        fetch(`${ROOT}script.js`, { cache: "no-store" })
      ]);
      if (![htmlResponse, scheduleResponse, appResponse].every(response => response.ok)) throw new Error("Original app files could not be loaded");

      let [html, scheduleSource, appSource] = await Promise.all([
        htmlResponse.text(), scheduleResponse.text(), appResponse.text()
      ]);

      appSource = rewriteRuntimePaths(appSource.replace(/\blocalStorage\b/g, "window.__sandboxStorage"));
      scheduleSource = isolationBootstrapSource() + rewriteRuntimePaths(scheduleSource.replace(/\blocalStorage\b/g, "window.__sandboxStorage"));

      const scheduleUrl = URL.createObjectURL(new Blob([scheduleSource], { type: "text/javascript" }));
      const appUrl = URL.createObjectURL(new Blob([appSource], { type: "text/javascript" }));

      html = html
        .replace(/<link\b[^>]*rel=["']manifest["'][^>]*>/gi, "")
        .replace(/<script\b[^>]*src=["'][^"']*pwa\.js[^"']*["'][^>]*><\/script>/gi, "")
        .replace("<head>", `<head><base href="${ROOT}">`)
        .replace("</head>", `<link rel="stylesheet" href="./sandbox/sandbox-theme.css?v=20260619fullclone"></head>`)
        .replace(/<body([^>]*)>/i, '<body$1 class="sandbox-full-clone">')
        .replace("</body>", '<div id="sandbox-clone-badge" aria-hidden="true"><span></span>FULL CLONE SANDBOX</div></body>')
        .replace(/<title>[^<]*<\/title>/i, "<title>takarei · Full Clone Sandbox</title>");

      html = replaceExternalScript(html, /<script\b[^>]*src=["'][^"']*schedule\/schedule\.js[^"']*["'][^>]*><\/script>/i, scheduleUrl);
      html = replaceExternalScript(html, /<script\b[^>]*src=["'][^"']*script\.js[^"']*["'][^>]*><\/script>/i, appUrl);

      document.open();
      document.write(html);
      document.close();
    } catch (error) {
      console.error("Sandbox clone boot failed", error);
      document.body.innerHTML = '<div class="boot"><span class="boot-mark">!</span><b>元アプリを読み込めませんでした</b><small>ローカルサーバーから開き直してください</small></div>';
    }
  }

  boot();
})();
