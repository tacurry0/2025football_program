(function () {
  "use strict";

  const STORAGE_KEY = "stadiumVisionApp.v2";
  const CHANNEL_NAME = "stadiumVisionAppLive";

  const defaultState = {
    colors: {
      home: "#bd211a",
      away: "#166bc5",
      center: "#d83618"
    },
    textColors: {
      homeClub: "#f4e5fb",
      awayClub: "#f4e5fb",
      homeNumber: "#ffffff",
      awayNumber: "#ffffff"
    },
    images: {
      league: "",
      bottom: ""
    },
    image: "",
    home: {
      club: "アルビレックス新潟",
      players: [
        { pos: "GK", no: "64", family: "バウマン", given: "" },
        { pos: "DF", no: "2", family: "ジェイソン", given: "ゲリア", half: true },
        { pos: "", no: "25", family: "藤原", given: "奏哉" },
        { pos: "", no: "26", family: "佐藤", given: "海宏" },
        { pos: "", no: "77", family: "船木", given: "翔" },
        { pos: "MF", no: "7", family: "大西", given: "悠介" },
        { pos: "", no: "17", family: "シマブク", given: "カズヨシ", half: true },
        { pos: "", no: "22", family: "新井", given: "泰貴" },
        { pos: "", no: "30", family: "奥村", given: "仁" },
        { pos: "FW", no: "18", family: "若月", given: "大和" },
        { pos: "", no: "55", family: "マテウス", given: "モラエス", half: true }
      ]
    },
    away: {
      club: "ＦＣ大阪",
      players: [
        { pos: "GK", no: "1", family: "菅原", given: "大道" },
        { pos: "DF", no: "11", family: "堤", given: "奏一郎" },
        { pos: "", no: "40", family: "川上", given: "竜" },
        { pos: "", no: "4", family: "山下", given: "諒時" },
        { pos: "", no: "13", family: "美馬", given: "和也" },
        { pos: "MF", no: "37", family: "家坂", given: "葉光" },
        { pos: "FW", no: "9", family: "島田", given: "拓海" },
        { pos: "MF", no: "19", family: "増田", given: "隼司" },
        { pos: "", no: "36", family: "森村", given: "俊太" },
        { pos: "FW", no: "28", family: "東家", given: "聡樹" },
        { pos: "MF", no: "18", family: "夏川", given: "大和" }
      ]
    },
    match: {
      league: "明治安田\nJ2・J3 百年構想リーグ",
      round: "第12節",
      firstHome: "0",
      firstAway: "0",
      secondHome: "1",
      secondAway: "0",
      totalHome: "1",
      totalAway: "0"
    }
  };

  const kanaMap = {
    "ア": "ｱ", "イ": "ｲ", "ウ": "ｳ", "エ": "ｴ", "オ": "ｵ",
    "カ": "ｶ", "キ": "ｷ", "ク": "ｸ", "ケ": "ｹ", "コ": "ｺ",
    "サ": "ｻ", "シ": "ｼ", "ス": "ｽ", "セ": "ｾ", "ソ": "ｿ",
    "タ": "ﾀ", "チ": "ﾁ", "ツ": "ﾂ", "テ": "ﾃ", "ト": "ﾄ",
    "ナ": "ﾅ", "ニ": "ﾆ", "ヌ": "ﾇ", "ネ": "ﾈ", "ノ": "ﾉ",
    "ハ": "ﾊ", "ヒ": "ﾋ", "フ": "ﾌ", "ヘ": "ﾍ", "ホ": "ﾎ",
    "マ": "ﾏ", "ミ": "ﾐ", "ム": "ﾑ", "メ": "ﾒ", "モ": "ﾓ",
    "ヤ": "ﾔ", "ユ": "ﾕ", "ヨ": "ﾖ",
    "ラ": "ﾗ", "リ": "ﾘ", "ル": "ﾙ", "レ": "ﾚ", "ロ": "ﾛ",
    "ワ": "ﾜ", "ヲ": "ｦ", "ン": "ﾝ",
    "ガ": "ｶﾞ", "ギ": "ｷﾞ", "グ": "ｸﾞ", "ゲ": "ｹﾞ", "ゴ": "ｺﾞ",
    "ザ": "ｻﾞ", "ジ": "ｼﾞ", "ズ": "ｽﾞ", "ゼ": "ｾﾞ", "ゾ": "ｿﾞ",
    "ダ": "ﾀﾞ", "ヂ": "ﾁﾞ", "ヅ": "ﾂﾞ", "デ": "ﾃﾞ", "ド": "ﾄﾞ",
    "バ": "ﾊﾞ", "ビ": "ﾋﾞ", "ブ": "ﾌﾞ", "ベ": "ﾍﾞ", "ボ": "ﾎﾞ",
    "パ": "ﾊﾟ", "ピ": "ﾋﾟ", "プ": "ﾌﾟ", "ペ": "ﾍﾟ", "ポ": "ﾎﾟ",
    "ァ": "ｧ", "ィ": "ｨ", "ゥ": "ｩ", "ェ": "ｪ", "ォ": "ｫ",
    "ャ": "ｬ", "ュ": "ｭ", "ョ": "ｮ", "ッ": "ｯ", "ー": "ｰ"
  };

  const halfSmallKana = new Set(["ｧ", "ｨ", "ｩ", "ｪ", "ｫ", "ｬ", "ｭ", "ｮ", "ｯ"]);
  const marks = new Set(["ﾞ", "ﾟ"]);

  function makeDefaultLeagueImage() {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="330" height="82" viewBox="0 0 330 82">
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="2" dy="2" stdDeviation="0.8" flood-color="#000" flood-opacity="0.76"/>
        </filter>
      </defs>
      <g filter="url(#shadow)" fill="#f7e8fb">
        <circle cx="49" cy="41" r="29" fill="none" stroke="#f7e8fb" stroke-width="4" stroke-dasharray="2.5 5"/>
        <circle cx="49" cy="41" r="17" fill="none" stroke="#f7e8fb" stroke-width="2.5"/>
        <text x="49" y="36" font-family="Arial, sans-serif" font-size="14" font-weight="900" text-anchor="middle">J2</text>
        <text x="49" y="52" font-family="Arial, sans-serif" font-size="14" font-weight="900" text-anchor="middle">J3</text>
        <text x="92" y="35" font-family="BIZ UDPGothic, Noto Sans JP, sans-serif" font-size="25" font-weight="900">明治安田</text>
        <text x="92" y="63" font-family="BIZ UDPGothic, Noto Sans JP, sans-serif" font-size="24" font-weight="900">J2・J3 百年構想リーグ</text>
      </g>
    </svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  const DEFAULT_LEAGUE_IMAGE = makeDefaultLeagueImage();

  const channel = "BroadcastChannel" in window ? new BroadcastChannel(CHANNEL_NAME) : null;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? normalizeState(JSON.parse(raw)) : clone(defaultState);
    } catch (error) {
      return clone(defaultState);
    }
  }

  function normalizeState(input) {
    const state = clone(defaultState);
    if (!input || typeof input !== "object") return state;

    if (input.colors) {
      state.colors.home = input.colors.home || state.colors.home;
      state.colors.away = input.colors.away || state.colors.away;
      state.colors.center = input.colors.center || state.colors.center;
    }
    if (input.textColors) {
      state.textColors.homeClub = input.textColors.homeClub || state.textColors.homeClub;
      state.textColors.awayClub = input.textColors.awayClub || state.textColors.awayClub;
      state.textColors.homeNumber = input.textColors.homeNumber || state.textColors.homeNumber;
      state.textColors.awayNumber = input.textColors.awayNumber || state.textColors.awayNumber;
    }
    if (input.images) {
      state.images.league = input.images.league || "";
      state.images.bottom = input.images.bottom || "";
    }
    state.images.bottom = state.images.bottom || input.image || "";
    state.image = state.images.bottom;

    ["home", "away"].forEach((side) => {
      if (!input[side]) return;
      state[side].club = input[side].club ?? state[side].club;
      if (Array.isArray(input[side].players)) {
        input[side].players.slice(0, 11).forEach((player, index) => {
          const defaultHalf = Boolean(state[side].players[index] && state[side].players[index].half);
          state[side].players[index] = {
            pos: player.pos ?? "",
            no: player.no ?? "",
            family: player.family ?? "",
            given: player.given ?? "",
            half: player.half === undefined ? defaultHalf : Boolean(player.half)
          };
        });
      }
    });

    if (input.match) {
      Object.keys(state.match).forEach((key) => {
        state.match[key] = input.match[key] ?? state.match[key];
      });
    }

    return state;
  }

  function saveState(state, broadcast) {
    const next = normalizeState(state);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    currentState = next;
    if (broadcast && channel) channel.postMessage(next);
  }

  function getPath(target, path) {
    return path.split(".").reduce((value, key) => (value == null ? "" : value[key]), target);
  }

  function setPath(target, path, value) {
    const parts = path.split(".");
    const last = parts.pop();
    const parent = parts.reduce((value, key) => value[key], target);
    parent[last] = value;
  }

  function toHalfWidthKana(value) {
    return Array.from(value || "").map((char) => kanaMap[char] || char).join("");
  }

  function isKanaLike(value) {
    return /[ァ-ヶーｦ-ﾟ]/.test(value || "");
  }

  function kanaUnits(value) {
    const normalized = toHalfWidthKana(value);
    const units = [];
    Array.from(normalized).forEach((char) => {
      if ((marks.has(char) || halfSmallKana.has(char)) && units.length) {
        units[units.length - 1] += char;
      } else {
        units.push(char);
      }
    });
    return units;
  }

  function textUnits(value, compact) {
    if (!value) return [];
    return compact ? kanaUnits(value) : Array.from(value);
  }

  function createNameBlock(kind, text, compact) {
    const units = textUnits(text, compact);
    const block = document.createElement("span");
    block.className = `${kind} name-chars ${units.length ? `n${Math.min(units.length, 4)}` : "empty"}${compact ? " kana" : ""}`;
    units.forEach((unit) => {
      const span = document.createElement("span");
      span.textContent = unit;
      block.appendChild(span);
    });
    return block;
  }

  function createPlayerName(player) {
    const compact = Boolean(player.half);
    const familyUnits = textUnits(player.family, compact);
    const givenUnits = textUnits(player.given, compact);
    const name = document.createElement("div");
    name.className = "player-name";
    if (!player.given) name.classList.add("full-name");
    if (compact || familyUnits.length > 3 || givenUnits.length > 3) name.classList.add("long-name");
    name.append(createNameBlock("family-name", player.family, compact));
    name.append(createNameBlock("given-name", player.given, compact));
    return name;
  }

  function renderLineup(container, players, side) {
    if (!container) return;
    container.textContent = "";
    players.forEach((player) => {
      const row = document.createElement("div");
      row.className = "player-row";

      const pos = document.createElement("div");
      pos.className = "pos";
      pos.textContent = player.pos;

      const num = document.createElement("div");
      num.className = `num ${side}-num`;
      num.textContent = player.no;

      row.append(pos, num, createPlayerName(player));
      container.appendChild(row);
    });
  }

  function renderFields(state) {
    document.querySelectorAll("[data-field]").forEach((node) => {
      const value = String(getPath(state, node.dataset.field) ?? "");
      node.textContent = "";
      value.split("\n").forEach((line, index) => {
        if (index) node.appendChild(document.createElement("br"));
        node.appendChild(document.createTextNode(line));
      });
    });
  }

  function colorMix(color, percent) {
    const hex = color.replace("#", "");
    const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex.padEnd(6, "0").slice(0, 6);
    const num = parseInt(full, 16);
    const r = Math.min(255, Math.max(0, ((num >> 16) & 255) + percent));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 255) + percent));
    const b = Math.min(255, Math.max(0, (num & 255) + percent));
    return `rgb(${r}, ${g}, ${b})`;
  }

  function applyColors(state) {
    const root = document.documentElement;
    root.style.setProperty("--home-color", state.colors.home);
    root.style.setProperty("--home-color-light", colorMix(state.colors.home, 34));
    root.style.setProperty("--home-color-dark", colorMix(state.colors.home, -42));
    root.style.setProperty("--away-color", state.colors.away);
    root.style.setProperty("--away-color-light", colorMix(state.colors.away, 34));
    root.style.setProperty("--away-color-dark", colorMix(state.colors.away, -48));
    root.style.setProperty("--center-color", state.colors.center);
    root.style.setProperty("--center-color-light", colorMix(state.colors.center, 34));
    root.style.setProperty("--center-color-dark", colorMix(state.colors.center, -58));
    root.style.setProperty("--home-club-text", state.textColors.homeClub);
    root.style.setProperty("--away-club-text", state.textColors.awayClub);
    root.style.setProperty("--home-number-text", state.textColors.homeNumber);
    root.style.setProperty("--away-number-text", state.textColors.awayNumber);
  }

  function renderImages(state) {
    const leagueImage = document.getElementById("leagueImage");
    if (leagueImage) {
      leagueImage.src = state.images.league || DEFAULT_LEAGUE_IMAGE;
    }

    const image = document.getElementById("customLogo");
    const fallback = document.getElementById("defaultLogo");
    if (!image || !fallback) return;
    if (state.images.bottom) {
      image.src = state.images.bottom;
      image.style.display = "block";
      fallback.style.display = "none";
    } else {
      image.removeAttribute("src");
      image.style.display = "none";
      fallback.style.display = "block";
    }
  }

  function renderDisplay(state) {
    applyColors(state);
    renderFields(state);
    renderLineup(document.getElementById("homeLineup"), state.home.players, "home");
    renderLineup(document.getElementById("awayLineup"), state.away.players, "away");
    renderImages(state);
  }

  function createPlayerEditor(container, side, state) {
    if (!container) return;
    container.textContent = "";
    const header = document.createElement("div");
    header.className = "player-edit-row player-edit-head";
    ["POS", "No.", "姓", "名", "半角"].forEach((label) => {
      const span = document.createElement("span");
      span.textContent = label;
      header.appendChild(span);
    });
    container.appendChild(header);

    state[side].players.forEach((player, index) => {
      const row = document.createElement("div");
      row.className = "player-edit-row";
      [
        ["pos", "GK"],
        ["no", "64"],
        ["family", "藤原"],
        ["given", "奏哉"]
      ].forEach(([key, placeholder]) => {
        const input = document.createElement("input");
        input.name = `${side}.players.${index}.${key}`;
        input.value = player[key];
        input.placeholder = placeholder;
        row.appendChild(input);
      });
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = `half-toggle${player.half ? " active" : ""}`;
      toggle.dataset.halfToggle = "true";
      toggle.dataset.side = side;
      toggle.dataset.index = String(index);
      toggle.textContent = player.half ? "半角ON" : "半角";
      toggle.title = "カタカナの半角表示を切り替えます";
      row.appendChild(toggle);
      container.appendChild(row);
    });
  }

  function fillForm(form, state) {
    form.querySelectorAll("[name]").forEach((field) => {
      if (field.type === "file") return;
      field.value = getPath(state, field.name) ?? "";
    });
  }

  function readForm(form, state) {
    const next = normalizeState(state);
    form.querySelectorAll("[name]").forEach((field) => {
      if (field.type === "file") return;
      setPath(next, field.name, field.value);
    });
    return next;
  }

  function readImageFile(input, callback) {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => callback(String(reader.result || "")));
    reader.readAsDataURL(file);
  }

  function normalizeOfficialText(value) {
    return String(value || "")
      .replace(/\r/g, "")
      .replace(/\u3000/g, " ")
      .normalize("NFKC");
  }

  function normalizeOfficialUrl(url) {
    const value = String(url || "").trim();
    if (!/^https?:\/\/data\.j-league\.or\.jp\/SFMS02\//i.test(value)) {
      throw new Error("J.LEAGUE Data Site の公式記録URLを入力してください。");
    }
    return value.replace(/^https:\/\//i, "http://");
  }

  const LEAGUE_LOGOS = {
    j1: "icons/j1.png",
    j2: "icons/j2.png",
    hundred: "icons/100l.png"
  };

  const CLUB_COLOR_LIST = [
    ["北海道コンサドーレ札幌", "#d6001c"], ["札幌", "#d6001c"],
    ["ヴァンラーレ八戸", "#0f8a4b"], ["八戸", "#0f8a4b"],
    ["いわてグルージャ盛岡", "#d71920"], ["岩手", "#d71920"], ["盛岡", "#d71920"],
    ["ベガルタ仙台", "#f5d000"], ["仙台", "#f5d000"],
    ["ブラウブリッツ秋田", "#004098"], ["秋田", "#004098"],
    ["モンテディオ山形", "#0068b7"], ["山形", "#0068b7"],
    ["福島ユナイテッドFC", "#e60012"], ["福島", "#e60012"],
    ["いわきFC", "#d6001c"], ["いわき", "#d6001c"],
    ["鹿島アントラーズ", "#b51e3a"], ["鹿島", "#b51e3a"],
    ["水戸ホーリーホック", "#005bac"], ["水戸", "#005bac"],
    ["栃木SC", "#ffd900"], ["栃木", "#ffd900"],
    ["ザスパ群馬", "#003f8f"], ["群馬", "#003f8f"],
    ["浦和レッズ", "#e60012"], ["浦和", "#e60012"],
    ["RB大宮アルディージャ", "#f58220"], ["大宮アルディージャ", "#f58220"], ["大宮", "#f58220"],
    ["ジェフユナイテッド千葉", "#ffd800"], ["千葉", "#ffd800"],
    ["柏レイソル", "#fff100"], ["柏", "#fff100"],
    ["FC東京", "#003f8f"], ["東京", "#003f8f"],
    ["東京ヴェルディ", "#00843d"], ["東京V", "#00843d"],
    ["FC町田ゼルビア", "#005bac"], ["町田", "#005bac"],
    ["川崎フロンターレ", "#00a0e9"], ["川崎F", "#00a0e9"], ["川崎", "#00a0e9"],
    ["横浜F・マリノス", "#005bac"], ["横浜FM", "#005bac"],
    ["横浜FC", "#00a3e0"],
    ["湘南ベルマーレ", "#7ab800"], ["湘南", "#7ab800"],
    ["SC相模原", "#00a650"], ["相模原", "#00a650"],
    ["ヴァンフォーレ甲府", "#005bac"], ["甲府", "#005bac"],
    ["松本山雅FC", "#00843d"], ["松本", "#00843d"],
    ["AC長野パルセイロ", "#f58220"], ["長野", "#f58220"],
    ["アルビレックス新潟", "#ff6600"], ["新潟", "#ff6600"],
    ["カターレ富山", "#005bac"], ["富山", "#005bac"],
    ["ツエーゲン金沢", "#e60012"], ["金沢", "#e60012"],
    ["清水エスパルス", "#f58220"], ["清水", "#f58220"],
    ["ジュビロ磐田", "#62b5e5"], ["磐田", "#62b5e5"],
    ["藤枝MYFC", "#6f2da8"], ["藤枝", "#6f2da8"],
    ["アスルクラロ沼津", "#00a0e9"], ["沼津", "#00a0e9"],
    ["名古屋グランパス", "#e60012"], ["名古屋", "#e60012"],
    ["FC岐阜", "#005bac"], ["岐阜", "#005bac"],
    ["京都サンガF.C.", "#6f2da8"], ["京都", "#6f2da8"],
    ["ガンバ大阪", "#005bac"], ["G大阪", "#005bac"],
    ["セレッソ大阪", "#e91e63"], ["C大阪", "#e91e63"],
    ["FC大阪", "#005bac"],
    ["ヴィッセル神戸", "#a50034"], ["神戸", "#a50034"],
    ["奈良クラブ", "#003f8f"], ["奈良", "#003f8f"],
    ["ガイナーレ鳥取", "#78be20"], ["鳥取", "#78be20"],
    ["ファジアーノ岡山", "#b00020"], ["岡山", "#b00020"],
    ["サンフレッチェ広島", "#51318f"], ["広島", "#51318f"],
    ["レノファ山口FC", "#f58220"], ["山口", "#f58220"],
    ["カマタマーレ讃岐", "#77bc1f"], ["讃岐", "#77bc1f"],
    ["徳島ヴォルティス", "#004098"], ["徳島", "#004098"],
    ["愛媛FC", "#f58220"], ["愛媛", "#f58220"],
    ["FC今治", "#003f8f"], ["今治", "#003f8f"],
    ["アビスパ福岡", "#003f8f"], ["福岡", "#003f8f"],
    ["ギラヴァンツ北九州", "#f5d000"], ["北九州", "#f5d000"],
    ["サガン鳥栖", "#00a0e9"], ["鳥栖", "#00a0e9"],
    ["V・ファーレン長崎", "#f58220"], ["長崎", "#f58220"],
    ["ロアッソ熊本", "#cc0000"], ["熊本", "#cc0000"],
    ["大分トリニータ", "#005bac"], ["大分", "#005bac"],
    ["テゲバジャーロ宮崎", "#e60012"], ["宮崎", "#e60012"],
    ["鹿児島ユナイテッドFC", "#005bac"], ["鹿児島", "#005bac"],
    ["FC琉球", "#8a1538"], ["琉球", "#8a1538"],
    ["高知ユナイテッドSC", "#b51e3a"], ["高知", "#b51e3a"],
    ["レイラック滋賀FC", "#005bac"], ["滋賀", "#005bac"]
  ];

  function normalizeClubColorName(name) {
    return normalizeOfficialText(name)
      .replace(/[\s・.．\-ー]/g, "")
      .toUpperCase();
  }

  const CLUB_COLOR_MAP = CLUB_COLOR_LIST.reduce((map, item) => {
    map[normalizeClubColorName(item[0])] = item[1];
    return map;
  }, {});

  function getClubPrimaryColor(name) {
    const key = normalizeClubColorName(name);
    if (!key) return "";
    if (CLUB_COLOR_MAP[key]) return CLUB_COLOR_MAP[key];
    const found = Object.keys(CLUB_COLOR_MAP).find((candidate) => (
      candidate.length >= 2 && (key.includes(candidate) || candidate.includes(key))
    ));
    return found ? CLUB_COLOR_MAP[found] : "";
  }

  function getLeagueLogoFromText(value) {
    const text = normalizeOfficialText(value).replace(/\s+/g, "");
    if (!text) return "";
    if (text.includes("百年構想リーグ") || text.includes("100年構想") || text.includes("J2・J3")) {
      return LEAGUE_LOGOS.hundred;
    }
    if (/(^|[^A-Z0-9])J1([^A-Z0-9]|$)/i.test(text) || text.includes("明治安田J1")) {
      return LEAGUE_LOGOS.j1;
    }
    if (/(^|[^A-Z0-9])J2([^A-Z0-9]|$)/i.test(text) || text.includes("明治安田J2")) {
      return LEAGUE_LOGOS.j2;
    }
    return "";
  }

  function extractOfficialLeagueName(text) {
    const officialMatch = text.match(/##\s*公式記録\s*\n+([^\n]+)/);
    if (officialMatch) return officialMatch[1].trim();
    const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
    return lines.find((line) => (
      /明治安田|J1|J2|百年構想リーグ/.test(line) && /第\s*\d+\s*節/.test(line)
    )) || "";
  }

  async function fetchOfficialRecordText(url) {
    const officialUrl = normalizeOfficialUrl(url);
    const proxyUrl = `https://r.jina.ai/http://${officialUrl.replace(/^https?:\/\//i, "")}`;
    const response = await fetch(proxyUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`公式記録を取得できませんでした (${response.status})`);
    return response.text();
  }

  function splitPlayerName(name) {
    const clean = normalizeOfficialText(name).replace(/\s+/g, " ").trim();
    if (!clean) return { family: "", given: "", half: false };
    const parts = clean.split(" ");
    const family = parts.shift() || "";
    const given = parts.join(" ");
    const kanaOnly = /^[ァ-ヶーA-Za-z0-9・.\-\s]+$/.test(clean);
    return { family, given, half: kanaOnly && clean.length > 4 };
  }

  function parseStarterLines(block) {
    const lines = block.split("\n").map((line) => normalizeOfficialText(line).trim()).filter(Boolean);
    const players = [];
    lines.forEach((line) => {
      const match = line.match(/^(GK|DF|MF|FW)\s+(\d+)\s+(.+?)(?:\s+\d+'\s*)?$/);
      if (!match) return;
      const parsedName = splitPlayerName(match[3]);
      players.push({
        pos: match[1],
        no: match[2],
        family: parsedName.family,
        given: parsedName.given,
        half: parsedName.half
      });
    });
    return players.slice(0, 11);
  }

  function extractTeamStarters(text, teamName) {
    const marker = `### ${teamName}`;
    const teamIndex = text.indexOf(marker);
    if (teamIndex === -1) return [];
    const teamBlock = text.slice(teamIndex);
    const starterIndex = teamBlock.indexOf("#### 先発");
    if (starterIndex === -1) return [];
    const starterBlock = teamBlock.slice(starterIndex + "#### 先発".length);
    const endCandidates = ["### ", "#### 控え", "#### 交代", "#### 警告", "#### 退場"]
      .map((token) => starterBlock.indexOf(token))
      .filter((index) => index > 0);
    const endIndex = endCandidates.length ? Math.min(...endCandidates) : starterBlock.length;
    return parseStarterLines(starterBlock.slice(0, endIndex));
  }

  function parseOfficialRecord(rawText) {
    const text = normalizeOfficialText(rawText);
    const leagueName = extractOfficialLeagueName(text);
    const scoreMatch = text.match(/\|\s*\[([^\]]+)\][^|]*\|\s*(\d+)\s*\|\s*(\d+)\s*前半\s*(\d+)\s*(\d+)\s*後半\s*(\d+)\s*\|\s*(\d+)\s*\|\s*\[([^\]]+)\]/);
    if (!scoreMatch) throw new Error("スコアとクラブ名を読み取れませんでした。");

    const roundMatch = text.match(/第\s*(\d+)\s*節/);
    const homeClub = scoreMatch[1].trim();
    const awayClub = scoreMatch[8].trim();
    const homePlayers = extractTeamStarters(text, homeClub);
    const awayPlayers = extractTeamStarters(text, awayClub);
    if (homePlayers.length < 11 || awayPlayers.length < 11) {
      throw new Error("先発メンバーを11人ずつ読み取れませんでした。");
    }

    return {
      homeClub,
      awayClub,
      homePlayers,
      awayPlayers,
      leagueName,
      leagueLogo: getLeagueLogoFromText(leagueName),
      match: {
        round: roundMatch ? `第${roundMatch[1]}節` : defaultState.match.round,
        firstHome: scoreMatch[3],
        firstAway: scoreMatch[4],
        secondHome: scoreMatch[5],
        secondAway: scoreMatch[6],
        totalHome: scoreMatch[2],
        totalAway: scoreMatch[7]
      }
    };
  }

  function applyOfficialRecord(state, record) {
    const next = normalizeState(state);
    next.home.club = record.homeClub;
    next.away.club = record.awayClub;
    next.home.players = record.homePlayers;
    next.away.players = record.awayPlayers;
    Object.assign(next.match, record.match);
    const homeColor = getClubPrimaryColor(record.homeClub);
    const awayColor = getClubPrimaryColor(record.awayClub);
    if (homeColor) {
      next.colors.home = homeColor;
    }
    if (awayColor) next.colors.away = awayColor;
    next.colors.center = defaultState.colors.center;
    next.textColors.homeClub = "#ffffff";
    next.textColors.awayClub = "#ffffff";
    next.textColors.homeNumber = "#ffffff";
    next.textColors.awayNumber = "#ffffff";
    if (record.leagueLogo) next.images.league = record.leagueLogo;
    return next;
  }

  function nextFrame(targetWindow) {
    const win = targetWindow || window;
    return new Promise((resolve) => {
      win.requestAnimationFrame(() => win.requestAnimationFrame(resolve));
    });
  }

  function withTimeout(promise, ms, fallback) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (fallback instanceof Error) reject(fallback);
        else resolve(fallback);
      }, ms);
      Promise.resolve(promise).then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error) => {
          clearTimeout(timer);
          reject(error);
        }
      );
    });
  }

  function waitForFrame(frame) {
    if (!frame) return Promise.resolve();
    try {
      if (frame.contentDocument && frame.contentDocument.readyState === "complete") {
        return Promise.resolve();
      }
    } catch (error) {
      return Promise.resolve();
    }
    return new Promise((resolve) => frame.addEventListener("load", resolve, { once: true }));
  }

  function waitForImages(root) {
    const images = Array.from(root.querySelectorAll("img"));
    return Promise.all(images.map((image) => {
      if (!image.src || image.complete) return Promise.resolve();
      return new Promise((resolve) => {
        image.addEventListener("load", resolve, { once: true });
        image.addEventListener("error", resolve, { once: true });
      });
    }));
  }

  function collectCss(targetDoc) {
    return Array.from(targetDoc.styleSheets).map((sheet) => {
      try {
        return Array.from(sheet.cssRules).map((rule) => rule.cssText).join("\n");
      } catch (error) {
        return "";
      }
    }).join("\n");
  }

  function getPreviewFrame() {
    return document.querySelector(".vision-preview");
  }

  function getExportDocument() {
    const frame = getPreviewFrame();
    try {
      if (frame && frame.contentDocument) return frame.contentDocument;
    } catch (error) {
      return document;
    }
    return document;
  }

  function updatePreviewScale() {
    const stage = document.querySelector(".preview-stage");
    const frame = getPreviewFrame();
    if (!stage || !frame) return;
    const scale = Math.min(stage.clientWidth / 1920, stage.clientHeight / 1080);
    frame.style.setProperty("--preview-scale", String(scale || 0.5));
  }

  function initPreviewScaler(state) {
    const stage = document.querySelector(".preview-stage");
    const frame = getPreviewFrame();
    if (!stage || !frame) return;
    updatePreviewScale();
    frame.addEventListener("load", () => {
      updatePreviewScale();
      if (frame.contentWindow && frame.contentWindow.scoreboardVision) {
        frame.contentWindow.scoreboardVision.applyState(state);
      }
    });
    window.addEventListener("resize", updatePreviewScale);
    if ("ResizeObserver" in window) {
      new ResizeObserver(updatePreviewScale).observe(stage);
    }
  }

  function makeExportFileName(state) {
    const round = String(state.match && state.match.round ? state.match.round : "scoreboard")
      .replace(/[\\/:*?"<>|]/g, "")
      .trim();
    return `${round || "scoreboard"}-scoreboard.png`;
  }

  function parseHexColor(color, fallback) {
    const value = /^#[0-9a-f]{3,6}$/i.test(color || "") ? color : fallback;
    const hex = value.replace("#", "");
    const full = hex.length === 3 ? hex.split("").map((char) => char + char).join("") : hex.padEnd(6, "0").slice(0, 6);
    const number = parseInt(full, 16);
    return [(number >> 16) & 255, (number >> 8) & 255, number & 255];
  }

  function mixColor(color, amount, fallback) {
    const [r, g, b] = parseHexColor(color, fallback);
    return `rgb(${Math.min(255, Math.max(0, r + amount))}, ${Math.min(255, Math.max(0, g + amount))}, ${Math.min(255, Math.max(0, b + amount))})`;
  }

  function gradient(ctx, x, y, h, colors) {
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    colors.forEach(([stop, color]) => grad.addColorStop(stop, color));
    return grad;
  }

  function drawDots(ctx, x, y, w, h, color, gap, radius, offset) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.fillStyle = color;
    for (let yy = y + (offset || 0); yy < y + h; yy += gap) {
      for (let xx = x + (offset || 0); xx < x + w; xx += gap) {
        ctx.beginPath();
        ctx.arc(xx, yy, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function fillRectWithBorder(ctx, x, y, w, h, fill, border, borderWidth) {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
    if (borderWidth) {
      ctx.lineWidth = borderWidth;
      ctx.strokeStyle = border;
      ctx.strokeRect(x + borderWidth / 2, y + borderWidth / 2, w - borderWidth, h - borderWidth);
    }
  }

  function setHeavyFont(ctx, size) {
    ctx.font = `900 ${size}px "BIZ UDPGothic", "Noto Sans JP", "Yu Gothic", "Meiryo", sans-serif`;
  }

  function setLatinFont(ctx, size) {
    ctx.font = `900 ${size}px Arial, "Noto Sans JP", sans-serif`;
  }

  function drawShadowText(ctx, text, x, y, options) {
    const {
      color = "#fff",
      align = "center",
      baseline = "middle",
      maxWidth = null,
      shadow = true,
      stroke = true
    } = options || {};
    ctx.save();
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    if (shadow) {
      ctx.fillStyle = "rgba(0,0,0,0.78)";
      ctx.fillText(text, x + 3, y + 3, maxWidth || undefined);
      ctx.fillStyle = "rgba(0,0,0,0.32)";
      ctx.fillText(text, x + 6, y + 6, maxWidth || undefined);
    }
    if (stroke) {
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = "rgba(255,255,255,0.28)";
      ctx.strokeText(text, x, y, maxWidth || undefined);
    }
    ctx.fillStyle = color;
    ctx.fillText(text, x, y, maxWidth || undefined);
    ctx.restore();
  }

  function fitFont(ctx, text, maxWidth, startSize, minSize, fontSetter) {
    let size = startSize;
    while (size > minSize) {
      fontSetter(ctx, size);
      if (ctx.measureText(text || "").width <= maxWidth) break;
      size -= 2;
    }
    fontSetter(ctx, size);
    return size;
  }

  function drawImageContained(ctx, image, x, y, w, h) {
    if (!image) return;
    const ratio = Math.min(w / image.width, h / image.height);
    const dw = image.width * ratio;
    const dh = image.height * ratio;
    ctx.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }

  function loadImageSafe(src) {
    return new Promise((resolve) => {
      if (!src) {
        resolve(null);
        return;
      }
      const image = new Image();
      let settled = false;
      const done = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      const timer = setTimeout(() => done(null), 1200);
      image.onload = () => {
        clearTimeout(timer);
        done(image);
      };
      image.onerror = () => {
        clearTimeout(timer);
        done(null);
      };
      image.src = src;
    });
  }

  function drawAdidas(ctx, x, y, w, h) {
    ctx.save();
    ctx.fillStyle = "#fbecff";
    ctx.shadowColor = "rgba(0,0,0,0.65)";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    const barW = w * 0.22;
    const gap = w * 0.08;
    const heights = [h * 0.36, h * 0.66, h * 0.98];
    const start = x + w * 0.07;
    ctx.transform(1, 0, -0.5, 1, 0, 0);
    heights.forEach((barH, index) => {
      const bx = start + index * (barW + gap) + (y + h) * 0.5;
      ctx.fillRect(bx, y + h - barH, barW, barH);
    });
    ctx.restore();
  }

  function drawScoreBox(ctx, x, y, w, h, left, label, right, total) {
    fillRectWithBorder(ctx, x, y, w, h, gradient(ctx, x, y, h, [[0, "#21151a"], [1, "#120b0f"]]), "rgba(0,0,0,0.88)", 2);
    drawDots(ctx, x, y, w, h, "rgba(93,70,78,0.12)", 9, 1.5, 1);
    setHeavyFont(ctx, 88);
    drawShadowText(ctx, String(left ?? ""), x + 80, y + h / 2, { color: "#f2ddf8", maxWidth: 115 });
    setHeavyFont(ctx, total ? 56 : 72);
    drawShadowText(ctx, label, x + w / 2, y + h / 2, { color: "#f2ddf8", maxWidth: 220 });
    setHeavyFont(ctx, 88);
    drawShadowText(ctx, String(right ?? ""), x + w - 80, y + h / 2, { color: "#f2ddf8", maxWidth: 115 });
  }

  function drawSpreadText(ctx, text, x, y, width, color, maxSize) {
    const value = String(text || "");
    if (!value) return;
    const units = Array.from(value);
    fitFont(ctx, value, width, maxSize, 24, setHeavyFont);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const span = units.length <= 1 ? 0 : width / Math.max(1, units.length - 1);
    const start = units.length <= 1 ? x + width / 2 : x;
    units.forEach((unit, index) => {
      drawShadowText(ctx, unit, start + span * index, y, { color, shadow: false, stroke: false });
    });
  }

  function drawPlayerRow(ctx, player, side, x, y, w, h, state) {
    const posW = side === "home" ? 105 : 103;
    const noW = 96;
    fillRectWithBorder(ctx, x, y, w, h, gradient(ctx, x, y, h, [[0, "#24161b"], [1, "#100a0d"]]), "rgba(0,0,0,0.78)", 1);
    drawDots(ctx, x, y, w, h, "rgba(95,72,79,0.14)", 9, 1.35, 2);

    ctx.strokeStyle = "rgba(0,0,0,0.72)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + posW, y);
    ctx.lineTo(x + posW, y + h);
    ctx.moveTo(x + posW + noW, y);
    ctx.lineTo(x + posW + noW, y + h);
    ctx.stroke();

    setHeavyFont(ctx, 52);
    drawShadowText(ctx, player.pos || "", x + posW / 2, y + h / 2, { color: "#f2ddf8", maxWidth: posW - 10 });

    const color = side === "home" ? state.colors.home : state.colors.away;
    const textColor = side === "home" ? state.textColors.homeNumber : state.textColors.awayNumber;
    const numX = x + posW;
    fillRectWithBorder(ctx, numX, y, noW, h, gradient(ctx, numX, y, h, [[0, mixColor(color, -42, "#bd211a")], [0.5, color], [1, mixColor(color, -42, "#bd211a")]]), "rgba(0,0,0,0.55)", 1);
    setHeavyFont(ctx, 61);
    drawShadowText(ctx, player.no || "", numX + noW / 2, y + h / 2, { color: textColor, maxWidth: noW - 8 });

    const nameX = x + posW + noW + 28;
    const compact = Boolean(player.half);
    const family = compact ? toHalfWidthKana(player.family) : player.family;
    const given = compact ? toHalfWidthKana(player.given) : player.given;
    drawSpreadText(ctx, family, nameX, y + h / 2, 150, "#fff", 49);
    if (given) {
      drawSpreadText(ctx, given, nameX + 204, y + h / 2, 160, "#fff", 49);
    }
  }

  function drawTeam(ctx, side, x, y, w, h, state) {
    const color = side === "home" ? state.colors.home : state.colors.away;
    const headerTextColor = side === "home" ? state.textColors.homeClub : state.textColors.awayClub;
    const headerGrad = gradient(ctx, x, y, 82, [[0, mixColor(color, 34, "#bd211a")], [0.5, color], [1, mixColor(color, -42, "#bd211a")]]);
    fillRectWithBorder(ctx, x, y, w, 82, headerGrad, "rgba(27,4,5,0.72)", 0);
    drawDots(ctx, x, y, w, 82, side === "home" ? "rgba(255,190,52,0.36)" : "rgba(118,194,255,0.22)", 10, 1.4, 1);
    fitFont(ctx, state[side].club || "", w - 44, 56, 30, setHeavyFont);
    drawShadowText(ctx, state[side].club || "", x + w / 2, y + 41, { color: headerTextColor, maxWidth: w - 36 });

    const lineupY = y + 92;
    const rowH = 894 / 11;
    state[side].players.forEach((player, index) => {
      drawPlayerRow(ctx, player, side, x, lineupY + rowH * index, w, rowH, state);
    });
  }

  function drawCenter(ctx, x, y, w, h, state, leagueImage, logoImage) {
    const bg = gradient(ctx, x, y, h, [
      [0, mixColor(state.colors.center, 34, "#d83618")],
      [0.54, state.colors.center],
      [1, mixColor(state.colors.center, -58, "#d83618")]
    ]);
    fillRectWithBorder(ctx, x, y, w, h, bg, "transparent", 0);
    drawDots(ctx, x, y, w, h, "rgba(255,184,47,0.62)", 11, 1.5, 1);
    const radial = ctx.createRadialGradient(x + w / 2, y + 160, 20, x + w / 2, y + 160, 320);
    radial.addColorStop(0, "rgba(255,104,36,0.46)");
    radial.addColorStop(1, "rgba(255,104,36,0)");
    ctx.fillStyle = radial;
    ctx.fillRect(x, y, w, h);

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.72)";
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    drawImageContained(ctx, leagueImage, x + 99, y + 22, 330, 82);
    ctx.restore();

    setHeavyFont(ctx, 65);
    drawShadowText(ctx, state.match.round || "", x + w / 2, y + 156, { color: "#f4e5fb", maxWidth: w - 40 });

    const boxX = x + 14;
    const boxW = w - 28;
    let scoreY = y + 219;
    drawScoreBox(ctx, boxX, scoreY, boxW, 140, state.match.firstHome, "前半", state.match.firstAway, false);
    scoreY += 178;
    drawScoreBox(ctx, boxX, scoreY, boxW, 140, state.match.secondHome, "後半", state.match.secondAway, false);
    scoreY += 160;
    fillRectWithBorder(ctx, boxX, scoreY, boxW, 16, gradient(ctx, boxX, scoreY, 16, [[0, "#f8e9bd"], [0.24, "#e7bf68"], [0.62, "#b46a1e"], [1, "#58230c"]]), "rgba(78,27,8,0.92)", 2);
    scoreY += 38;
    drawScoreBox(ctx, boxX, scoreY, boxW, 140, state.match.totalHome, "TOTAL", state.match.totalAway, true);

    if (logoImage) {
      drawImageContained(ctx, logoImage, x + w / 2 - 63, y + h - 104, 126, 78);
    } else {
      drawAdidas(ctx, x + w / 2 - 63, y + h - 104, 126, 78);
    }
  }

  async function makePngBlobFromState(state) {
    const canvas = document.createElement("canvas");
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext("2d");

    if (document.fonts && document.fonts.ready) {
      await withTimeout(document.fonts.ready.catch(() => {}), 900, null);
    }
    const [leagueImage, logoImage] = await Promise.all([
      loadImageSafe(state.images.league || DEFAULT_LEAGUE_IMAGE),
      loadImageSafe(state.images.bottom)
    ]);

    fillRectWithBorder(ctx, 0, 0, 1920, 1080, "#10161d", "transparent", 0);
    const bgRadial = ctx.createRadialGradient(960, 540, 80, 960, 540, 850);
    bgRadial.addColorStop(0, "#1c272f");
    bgRadial.addColorStop(0.72, "#0c1117");
    bgRadial.addColorStop(1, "#070a0d");
    ctx.fillStyle = bgRadial;
    ctx.fillRect(0, 0, 1920, 1080);

    const boardX = 24;
    const boardY = 32;
    const boardW = 1872;
    const boardH = 986;
    drawCenter(ctx, boardX, boardY, boardW, boardH, state, null, null);
    ctx.strokeStyle = "#c16b18";
    ctx.lineWidth = 2;
    ctx.strokeRect(boardX, boardY, boardW, boardH);
    ctx.strokeStyle = "rgba(246,107,20,0.82)";
    ctx.lineWidth = 2;
    ctx.strokeRect(boardX + 2, boardY + 2, boardW - 4, boardH - 4);

    drawTeam(ctx, "home", boardX, boardY, 672, boardH, state);
    drawCenter(ctx, boardX + 672, boardY, 528, boardH, state, leagueImage, logoImage);
    drawTeam(ctx, "away", boardX + 1200, boardY, 672, boardH, state);

    return canvasToPngBlob(canvas);
  }

  function canvasToPngBlob(canvas) {
    const dataUrlToBlob = () => {
      const dataUrl = canvas.toDataURL("image/png");
      const [header, data] = dataUrl.split(",");
      const mime = (header.match(/data:(.*?);/) || [])[1] || "image/png";
      const binary = atob(data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      return new Blob([bytes], { type: mime });
    };

    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (blob) => {
        if (settled) return;
        settled = true;
        if (blob) resolve(blob);
        else {
          try {
            resolve(dataUrlToBlob());
          } catch (error) {
            reject(error);
          }
        }
      };

      const fallbackTimer = setTimeout(() => finish(null), 1000);
      if (!canvas.toBlob) {
        clearTimeout(fallbackTimer);
        finish(null);
        return;
      }

      try {
        canvas.toBlob((blob) => {
          clearTimeout(fallbackTimer);
          finish(blob);
        }, "image/png");
      } catch (error) {
        clearTimeout(fallbackTimer);
        try {
          finish(dataUrlToBlob());
        } catch (fallbackError) {
          reject(error || fallbackError);
        }
      }
    });
  }

  async function makePngBlobFromDisplay(targetDoc) {
    const source = targetDoc.querySelector(".canvas") || targetDoc.getElementById("visionBoard");
    if (!source) throw new Error("export target was not found");

    if (targetDoc.fonts && targetDoc.fonts.ready) {
      await withTimeout(targetDoc.fonts.ready.catch(() => {}), 900, null);
    }
    await withTimeout(waitForImages(targetDoc), 1500, null);

    const targetWindow = targetDoc.defaultView || window;
    if (targetWindow.html2canvas) {
      const canvas = await targetWindow.html2canvas(source, {
        backgroundColor: null,
        scale: 1,
        width: 1920,
        height: 1080,
        windowWidth: 1920,
        windowHeight: 1080,
        scrollX: 0,
        scrollY: 0,
        useCORS: true,
        logging: false
      });
      return canvasToPngBlob(canvas);
    }

    const wrapper = targetDoc.createElement("div");
    wrapper.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
    wrapper.style.width = "1920px";
    wrapper.style.height = "1080px";
    wrapper.style.margin = "0";
    wrapper.style.position = "relative";
    wrapper.style.overflow = "hidden";

    const style = targetDoc.createElement("style");
    style.textContent = `${collectCss(targetDoc)}
      html, body { width: 1920px; height: 1080px; margin: 0; overflow: hidden; }
      .canvas { width: 1920px; height: 1080px; }
    `;
    wrapper.appendChild(style);
    wrapper.appendChild(source.cloneNode(true));

    const markup = new XMLSerializer().serializeToString(wrapper);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080"><foreignObject width="1920" height="1080">${markup}</foreignObject></svg>`;
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    const image = new Image();
    image.decoding = "sync";

    try {
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = url;
      });

      const canvas = document.createElement("canvas");
      canvas.width = 1920;
      canvas.height = 1080;
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0);
      return canvasToPngBlob(canvas);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function exportCurrentImage(state) {
    const next = normalizeState(state);
    const frame = getPreviewFrame();
    try {
      if (frame && frame.contentWindow && frame.contentWindow.scoreboardVision) {
        frame.contentWindow.scoreboardVision.applyState(next);
        await withTimeout(nextFrame(frame.contentWindow), 500, null);
      }
    } catch (error) {
      console.warn("Preview sync skipped", error);
    }
    if (!frame) {
      renderDisplay(next);
    }

    let blob;
    try {
      const targetDoc = getExportDocument();
      blob = await withTimeout(
        makePngBlobFromDisplay(targetDoc),
        8000,
        new Error("DOM capture timed out")
      );
    } catch (error) {
      console.warn("DOM capture failed; falling back to canvas renderer", error);
      blob = await withTimeout(
        makePngBlobFromState(next),
        9000,
        new Error("画像出力がタイムアウトしました。")
      );
    }
    downloadBlob(blob, makeExportFileName(next));
    return blob;
  }

  function initAdmin(state) {
    const form = document.getElementById("controlForm");
    if (!form) return;

    createPlayerEditor(document.getElementById("homeEditor"), "home", state);
    createPlayerEditor(document.getElementById("awayEditor"), "away", state);
    fillForm(form, state);
    initPreviewScaler(state);

    form.addEventListener("input", () => {
      state = readForm(form, state);
      saveState(state, true);
      renderDisplay(state);
    });

    form.addEventListener("click", (event) => {
      const toggle = event.target.closest("[data-half-toggle]");
      if (!toggle) return;
      state = readForm(form, state);
      const side = toggle.dataset.side;
      const index = Number(toggle.dataset.index);
      if (!state[side] || !state[side].players[index]) return;
      state[side].players[index].half = !state[side].players[index].half;
      saveState(state, true);
      renderDisplay(state);
      createPlayerEditor(document.getElementById("homeEditor"), "home", state);
      createPlayerEditor(document.getElementById("awayEditor"), "away", state);
      fillForm(form, state);
    });

    const leagueImageInput = document.getElementById("leagueImageInput");
    if (leagueImageInput) {
      leagueImageInput.addEventListener("change", () => {
        readImageFile(leagueImageInput, (dataUrl) => {
          state = readForm(form, state);
          state.images.league = dataUrl;
          saveState(state, true);
          renderDisplay(state);
        });
      });
    }

    const clearLeagueImage = document.getElementById("clearLeagueImage");
    if (clearLeagueImage) {
      clearLeagueImage.addEventListener("click", () => {
        state = readForm(form, state);
        state.images.league = "";
        if (leagueImageInput) leagueImageInput.value = "";
        saveState(state, true);
        renderDisplay(state);
      });
    }

    const logoInput = document.getElementById("logoInput");
    if (logoInput) {
      logoInput.addEventListener("change", () => {
        readImageFile(logoInput, (dataUrl) => {
          state = readForm(form, state);
          state.images.bottom = dataUrl;
          state.image = dataUrl;
          saveState(state, true);
          renderDisplay(state);
        });
      });
    }

    const clearLogo = document.getElementById("clearLogo");
    if (clearLogo) {
      clearLogo.addEventListener("click", () => {
        state = readForm(form, state);
        state.images.bottom = "";
        state.image = "";
        if (logoInput) logoInput.value = "";
        saveState(state, true);
        renderDisplay(state);
      });
    }

    const reset = document.getElementById("resetButton");
    if (reset) {
      reset.addEventListener("click", () => {
        state = clone(defaultState);
        saveState(state, true);
        createPlayerEditor(document.getElementById("homeEditor"), "home", state);
        createPlayerEditor(document.getElementById("awayEditor"), "away", state);
        fillForm(form, state);
        renderDisplay(state);
      });
    }

    const officialUrlInput = document.getElementById("officialUrlInput");
    const officialImportButton = document.getElementById("officialImportButton");
    const officialImportStatus = document.getElementById("officialImportStatus");
    const setOfficialStatus = (message, type) => {
      if (!officialImportStatus) return;
      officialImportStatus.textContent = message || "";
      officialImportStatus.classList.toggle("error", type === "error");
      officialImportStatus.classList.toggle("success", type === "success");
    };

    if (officialUrlInput && officialImportButton) {
      officialImportButton.addEventListener("click", async () => {
        const originalLabel = officialImportButton.textContent;
        officialImportButton.textContent = "取得中...";
        officialImportButton.disabled = true;
        setOfficialStatus("公式記録を取得しています。", "");
        try {
          const raw = await withTimeout(
            fetchOfficialRecordText(officialUrlInput.value),
            12000,
            new Error("公式記録の取得がタイムアウトしました。")
          );
          const record = parseOfficialRecord(raw);
          state = applyOfficialRecord(readForm(form, state), record);
          saveState(state, true);
          createPlayerEditor(document.getElementById("homeEditor"), "home", state);
          createPlayerEditor(document.getElementById("awayEditor"), "away", state);
          fillForm(form, state);
          renderDisplay(state);
          setOfficialStatus(`${record.homeClub} vs ${record.awayClub} を反映しました。`, "success");
        } catch (error) {
          console.error(error);
          setOfficialStatus(error.message || "公式記録の反映に失敗しました。", "error");
        } finally {
          officialImportButton.textContent = originalLabel;
          officialImportButton.disabled = false;
        }
      });
    }

    const exportButton = document.getElementById("exportImageButton");
    if (exportButton) {
      exportButton.addEventListener("click", async () => {
        const originalLabel = exportButton.textContent;
        exportButton.textContent = "出力中...";
        exportButton.disabled = true;
        try {
          state = readForm(form, state);
          saveState(state, true);
          await withTimeout(
            exportCurrentImage(state),
            11000,
            new Error("画像出力がタイムアウトしました。")
          );
        } catch (error) {
          console.error(error);
          alert("画像出力に失敗しました。もう一度お試しください。");
        } finally {
          exportButton.textContent = originalLabel;
          exportButton.disabled = false;
        }
      });
    }
  }

  function applyIncoming(state) {
    renderDisplay(state);
    const form = document.getElementById("controlForm");
    if (form && document.activeElement && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
      fillForm(form, state);
    }
  }

  let currentState = loadState();
  saveState(currentState, false);
  renderDisplay(currentState);
  initAdmin(currentState);

  window.scoreboardVision = {
    getState: () => normalizeState(currentState),
    applyState: (state) => {
      currentState = normalizeState(state);
      saveState(currentState, false);
      applyIncoming(currentState);
    },
    exportImage: () => exportCurrentImage(currentState)
  };

  if (channel) {
    channel.addEventListener("message", (event) => {
      currentState = normalizeState(event.data);
      applyIncoming(currentState);
    });
  }

  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      currentState = normalizeState(JSON.parse(event.newValue));
      applyIncoming(currentState);
    } catch (error) {
      currentState = clone(defaultState);
    }
  });
})();
