(() => {
  "use strict";

  const ROOT = "../";
  const STORAGE_PREFIX = "takarei_home_sandbox:";

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
        window.__homeSandboxStorage = {
          get length() { return ownKeys().length; },
          key(index) { return ownKeys()[index] ?? null; },
          getItem(key) { return rawGet.call(raw, prefix + String(key)); },
          setItem(key, value) { rawSet.call(raw, prefix + String(key), String(value)); },
          removeItem(key) { rawRemove.call(raw, prefix + String(key)); },
          clear() { ownKeys().forEach(key => rawRemove.call(raw, prefix + key)); }
        };
        window.__TAKAREI_HOME_SANDBOX__ = true;
        document.documentElement.dataset.homeSandboxStorage = "isolated";
      })();
    `;
  }

  function homeEnhancerSource() {
    return `
      (() => {
        const CLUBS = {
          niigata: {
            logo: "./data/assets/icons/alb_logo1.png",
            fallbackCompetition: "j2"
          },
          kumamoto: {
            logo: "./data/assets/icons/roasso_logo1.png",
            fallbackCompetition: "j3"
          }
        };
        const COMPETITIONS = {
          j2: { src: "./data/assets/icons/j2_2.png", alt: "J2" },
          j3: { src: "./data/assets/icons/j3_2.png", alt: "J3" },
          levain: { src: "./data/assets/icons/ylc_logo1.jpg", alt: "ルヴァンカップ" }
        };

        const getClub = (card) => {
          if (!card) return "";
          if (card.id && card.id.includes("kumamoto")) return "kumamoto";
          if (card.id && card.id.includes("niigata")) return "niigata";
          const parts = String(card.dataset.mid || "").split("_");
          return parts[1] || "";
        };

        const getCompetitionKey = (card, club) => {
          const text = [
            card && card.innerText,
            card && card.dataset.mid,
            card && card.querySelector(".dash-mw") && card.querySelector(".dash-mw").className
          ].filter(Boolean).join(" ");
          if (/ルヴァン|YLC|Jリーグカップ|Ｊリーグカップ|ナビスコ|round-levain/i.test(text)) return "levain";
          if (/(^|[^A-Z0-9])J3([^A-Z0-9]|$)|Ｊ3|Ｊ３/.test(text)) return "j3";
          if (/(^|[^A-Z0-9])J2([^A-Z0-9]|$)|Ｊ2|Ｊ２/.test(text)) return "j2";
          return CLUBS[club] ? CLUBS[club].fallbackCompetition : "j2";
        };

        const makeImg = (src, alt) => {
          const img = document.createElement("img");
          img.src = src;
          img.alt = alt || "";
          img.loading = "eager";
          img.decoding = "async";
          return img;
        };

        const enhanceCard = (card) => {
          const club = getClub(card);
          const clubInfo = CLUBS[club];
          if (!card || !clubInfo) return;
          card.classList.add("home-card-enhanced", "home-card-" + club);

          const header = card.querySelector(".dash-card-header");
          const teamName = header && header.querySelector(".dash-team-name");
          if (header && teamName && !header.querySelector(".home-club-lockup")) {
            const lockup = document.createElement("div");
            lockup.className = "home-club-lockup";
            const mark = document.createElement("span");
            mark.className = "home-club-mark";
            mark.appendChild(makeImg(clubInfo.logo, teamName.textContent.trim()));
            header.insertBefore(lockup, header.firstChild);
            lockup.appendChild(mark);
            lockup.appendChild(teamName);
          }

          const top = card.querySelector(".dash-card-body > div:first-child");
          if (top) {
            let logoBox = top.querySelector(".home-competition-logo");
            if (!logoBox) {
              logoBox = document.createElement("div");
              logoBox.className = "home-competition-logo";
              top.insertBefore(logoBox, top.firstChild);
            }
            const key = getCompetitionKey(card, club);
            const competition = COMPETITIONS[key] || COMPETITIONS.j2;
            if (logoBox.dataset.competitionKey !== key) {
              logoBox.dataset.competitionKey = key;
              logoBox.className = "home-competition-logo comp-" + key;
              logoBox.replaceChildren(makeImg(competition.src, competition.alt));
            }
          }
        };

        const enhanceDashboard = () => {
          document.querySelectorAll("#dashboard-cards-container .dash-card").forEach(enhanceCard);
        };

        const start = () => {
          enhanceDashboard();
          const root = document.getElementById("dashboard-cards-container");
          if (!root || root.dataset.homeEnhancerReady === "true") return;
          root.dataset.homeEnhancerReady = "true";
          new MutationObserver(enhanceDashboard).observe(root, { childList: true, subtree: true });
        };

        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", start, { once: true });
        } else {
          start();
        }
        window.addEventListener("load", start, { once: true });
        setTimeout(start, 800);
        setTimeout(start, 1800);
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

      appSource = rewriteRuntimePaths(appSource.replace(/\blocalStorage\b/g, "window.__homeSandboxStorage"));
      scheduleSource = isolationBootstrapSource() + rewriteRuntimePaths(scheduleSource.replace(/\blocalStorage\b/g, "window.__homeSandboxStorage"));

      const scheduleUrl = URL.createObjectURL(new Blob([scheduleSource], { type: "text/javascript" }));
      const appUrl = URL.createObjectURL(new Blob([appSource], { type: "text/javascript" }));

      html = html
        .replace(/<link\b[^>]*rel=["']manifest["'][^>]*>/gi, "")
        .replace(/<script\b[^>]*src=["'][^"']*pwa\.js[^"']*["'][^>]*><\/script>/gi, "")
        .replace("<head>", `<head><base href="${ROOT}">`)
        .replace("</head>", `<link rel="stylesheet" href="./sandbox/home-theme.css?v=20260625home7"></head>`)
        .replace(/<body([^>]*)>/i, '<body$1 class="sandbox-home-only">')
        .replace("</body>", `<div id="home-sandbox-badge" aria-hidden="true"><span></span>HOME SANDBOX</div><script>${homeEnhancerSource()}<\/script></body>`)
        .replace(/<title>[^<]*<\/title>/i, "<title>takarei - Home Sandbox</title>");

      html = replaceExternalScript(html, /<script\b[^>]*src=["'][^"']*schedule\/schedule\.js[^"']*["'][^>]*><\/script>/i, scheduleUrl);
      html = replaceExternalScript(html, /<script\b[^>]*src=["'][^"']*script\.js[^"']*["'][^>]*><\/script>/i, appUrl);

      document.open();
      document.write(html);
      document.close();
    } catch (error) {
      console.error("Home sandbox boot failed", error);
      document.body.innerHTML = '<div class="boot"><span class="boot-mark">!</span><b>元アプリを読み込めませんでした</b><small>ローカルサーバーから開き直してください</small></div>';
    }
  }

  boot();
})();
