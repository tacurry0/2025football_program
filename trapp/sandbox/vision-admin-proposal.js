(() => {
  "use strict";

  const players = {
    home: {
      starting: [
        ["GK", "64", "バウマン", ""], ["DF", "2", "ジェイソン", "ゲリア"], ["DF", "25", "藤原", "奏哉"],
        ["DF", "26", "佐藤", "海宏"], ["DF", "77", "船木", "翔"], ["MF", "7", "大西", "悠介"],
        ["MF", "17", "シマブク", "カズヨシ"], ["MF", "22", "新井", "泰貴"], ["MF", "30", "奥村", "仁"],
        ["FW", "18", "若月", "大和"], ["FW", "55", "マテウス", "モラエス"]
      ],
      reserve: [
        ["GK", "21", "田代", "琉我"], ["DF", "3", "稲村", "隼翔"], ["DF", "15", "早川", "史哉"],
        ["MF", "8", "白井", "永地"], ["MF", "14", "長谷川", "元希"], ["FW", "9", "鈴木", "孝司"], ["FW", "16", "小見", "洋太"]
      ]
    },
    away: {
      starting: [
        ["GK", "1", "菅原", "大道"], ["DF", "11", "堤", "奏一郎"], ["DF", "40", "川上", "竜"],
        ["DF", "4", "山下", "諒時"], ["DF", "13", "美馬", "和也"], ["MF", "37", "家坂", "葉光"],
        ["FW", "9", "島田", "拓海"], ["MF", "19", "増田", "隼司"], ["MF", "36", "森村", "俊太"],
        ["FW", "28", "東家", "聡樹"], ["MF", "18", "夏川", "大和"]
      ],
      reserve: [
        ["GK", "31", "山田", "晃士"], ["DF", "5", "坂本", "修佑"], ["DF", "23", "秋山", "拓也"],
        ["MF", "8", "禹", "相皓"], ["MF", "16", "下澤", "悠太"], ["FW", "10", "久保", "吏久斗"], ["FW", "27", "澤崎", "凌大"]
      ]
    }
  };

  const scorerData = {
    home: [["87", "若月", "大和", false], ["", "", "", false], ["", "", "", false]],
    away: [["", "", "", false], ["", "", "", false], ["", "", "", false]]
  };

  const refereeData = [
    ["主　審", "荒木　友輔"], ["副　審", "熊谷　幸剛"], ["副　審", "岩田　浩義"],
    ["第4の審判員", "赤阪　修"], ["VAR", "岡部　拓人"], ["AVAR", "西山　貴生"]
  ];

  const state = {
    workflow: "prepare",
    memberMode: "starting",
    teamSide: "home",
    scorerSide: "home",
    venueMode: "attendance",
    score: { firstHome: 0, firstAway: 0, secondHome: 1, secondAway: 0 }
  };

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  function showToast(message) {
    const toast = $("#toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2200);
  }

  function setWorkflow(name) {
    state.workflow = name;
    $$("[data-workflow]").forEach(button => {
      const active = button.dataset.workflow === name;
      button.classList.toggle("active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    });
    $$("[data-workflow-panel]").forEach(panel => {
      const active = panel.dataset.workflowPanel === name;
      panel.hidden = !active;
      panel.classList.toggle("active", active);
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function wireSegmentGroup(groupName, onChange) {
    const group = $(`[data-segment-group="${groupName}"]`);
    if (!group) return;
    group.addEventListener("click", event => {
      const button = event.target.closest("[data-segment]");
      if (!button) return;
      $$('[data-segment]', group).forEach(node => node.classList.toggle("active", node === button));
      state[groupName] = button.dataset.segment;
      onChange(button.dataset.segment);
    });
  }

  function renderMembers() {
    const list = $("#memberList");
    const title = $("#memberListTitle");
    if (!list || !title) return;
    const teamName = state.teamSide === "home" ? "新潟" : "FC大阪";
    const modeName = state.memberMode === "reserve" ? "リザーブ" : state.memberMode === "announce" ? "スタメン発表" : "スタメン";
    title.textContent = `${teamName} ${modeName}`;
    list.textContent = "";

    if (state.memberMode === "announce") {
      const wrap = document.createElement("div");
      wrap.className = "announcement-choice";
      wrap.innerHTML = `<span>表示チーム</span><strong>${teamName}</strong><small>スタメン発表画面に表示するチームです</small>`;
      list.appendChild(wrap);
      return;
    }

    const rows = players[state.teamSide][state.memberMode] || [];
    rows.forEach((player, index) => {
      const row = document.createElement("div");
      row.className = "member-row";
      row.innerHTML = `
        <label class="member-pos"><span class="sr-only">POS</span><input value="${player[0]}" aria-label="${index + 1}人目 POS"></label>
        <label class="member-no"><span class="sr-only">No.</span><input value="${player[1]}" inputmode="numeric" aria-label="${index + 1}人目 背番号"></label>
        <div class="member-name">
          <input value="${player[2]}" aria-label="${index + 1}人目 姓">
          <input value="${player[3]}" aria-label="${index + 1}人目 名">
        </div>
        <div class="member-flags">
          <button type="button" data-flag="half">半角</button>
          ${state.memberMode === "starting" ? '<button type="button" data-flag="yellow">YC</button>' : ""}
        </div>`;
      list.appendChild(row);
    });
  }

  function renderScorers() {
    const rows = $("#scorerRows");
    if (!rows) return;
    rows.textContent = "";
    scorerData[state.scorerSide].forEach((scorer, index) => {
      const row = document.createElement("div");
      row.className = "scorer-row";
      row.innerHTML = `
        <input value="${scorer[0]}" placeholder="87" inputmode="numeric" aria-label="${index + 1}人目 時間">
        <input value="${scorer[1]}" placeholder="姓" aria-label="${index + 1}人目 姓">
        <input value="${scorer[2]}" placeholder="名" aria-label="${index + 1}人目 名">
        <button type="button" class="${scorer[3] ? "active" : ""}" data-scorer-half>${scorer[3] ? "半角ON" : "半角"}</button>`;
      rows.appendChild(row);
    });
  }

  function renderReferees() {
    const list = $("#refereeList");
    if (!list) return;
    list.innerHTML = refereeData.map((item, index) => `
      <div class="referee-row">
        <input value="${item[0]}" aria-label="${index + 1}人目 役割">
        <input value="${item[1]}" aria-label="${index + 1}人目 氏名">
      </div>`).join("");
  }

  function updateScore() {
    const home = state.score.firstHome + state.score.secondHome;
    const away = state.score.firstAway + state.score.secondAway;
    Object.entries(state.score).forEach(([key, value]) => {
      $$(`[data-score-value="${key}"]`).forEach(node => { node.textContent = String(value); });
    });
    $$('[data-total-home]').forEach(node => { node.textContent = String(home); });
    $$('[data-total-away]').forEach(node => { node.textContent = String(away); });
  }

  function setVenuePane(name) {
    state.venueMode = name;
    $$('[data-venue-pane]').forEach(panel => {
      const active = panel.dataset.venuePane === name;
      panel.hidden = !active;
      panel.classList.toggle("active", active);
    });
  }

  function updatePreviewScales() {
    $$('.preview-frame-wrap, .large-preview').forEach(wrapper => {
      const frame = $('iframe', wrapper);
      if (!frame) return;
      const scale = wrapper.clientWidth / 1920;
      frame.style.transform = `scale(${scale})`;
    });
  }

  function closeOverlays() {
    document.body.classList.remove("overlay-open");
    $$('.side-sheet.open, .preview-sheet.open').forEach(sheet => {
      sheet.classList.remove("open");
      sheet.setAttribute("aria-hidden", "true");
    });
  }

  function openOverlay(target) {
    closeOverlays();
    target.classList.add("open");
    target.setAttribute("aria-hidden", "false");
    document.body.classList.add("overlay-open");
    window.requestAnimationFrame(updatePreviewScales);
  }

  function init() {
    $$("[data-workflow]").forEach(button => button.addEventListener("click", () => setWorkflow(button.dataset.workflow)));
    wireSegmentGroup("memberMode", renderMembers);
    wireSegmentGroup("teamSide", renderMembers);
    wireSegmentGroup("scorerSide", renderScorers);
    wireSegmentGroup("venueMode", setVenuePane);

    $("#memberList")?.addEventListener("click", event => {
      const button = event.target.closest("[data-flag]");
      if (!button) return;
      button.classList.toggle("on");
      button.textContent = button.dataset.flag === "half" ? (button.classList.contains("on") ? "半角ON" : "半角") : (button.classList.contains("on") ? "YC有" : "YC");
    });

    $("#scorerRows")?.addEventListener("click", event => {
      const button = event.target.closest("[data-scorer-half]");
      if (!button) return;
      button.classList.toggle("active");
      button.textContent = button.classList.contains("active") ? "半角ON" : "半角";
    });

    $("#addScorer")?.addEventListener("click", () => {
      scorerData[state.scorerSide].push(["", "", "", false]);
      renderScorers();
    });

    $$('[data-score]').forEach(button => button.addEventListener("click", () => {
      const key = button.dataset.score;
      state.score[key] = Math.max(0, state.score[key] + Number(button.dataset.delta || 0));
      updateScore();
    }));

    $$('[data-choice]').forEach(button => button.addEventListener("click", () => {
      $$('[data-choice]').forEach(node => node.classList.toggle("selected", node === button));
    }));

    $("#applyMatch")?.addEventListener("click", () => {
      const status = $("#applyStatus");
      if (status) {
        status.textContent = "第12節のデータを反映しました";
        status.classList.add("success");
      }
      showToast("試合データを反映しました");
    });

    const settingsSheet = $("#settingsSheet");
    const previewSheet = $("#previewSheet");
    $("#settingsOpen")?.addEventListener("click", () => openOverlay(settingsSheet));
    $$('[data-open-settings]').forEach(button => button.addEventListener("click", () => openOverlay(settingsSheet)));
    $("#previewOpen")?.addEventListener("click", () => openOverlay(previewSheet));
    $$('[data-open-preview]').forEach(button => button.addEventListener("click", () => openOverlay(previewSheet)));
    $$('[data-close-overlay]').forEach(button => button.addEventListener("click", closeOverlays));
    document.addEventListener("keydown", event => { if (event.key === "Escape") closeOverlays(); });

    $("#previewTabs")?.addEventListener("click", event => {
      const button = event.target.closest("[data-preview-src]");
      if (!button) return;
      $$('[data-preview-src]', $("#previewTabs")).forEach(node => node.classList.toggle("active", node === button));
      const frame = $("#proposalPreview");
      if (frame) frame.src = button.dataset.previewSrc;
      window.requestAnimationFrame(updatePreviewScales);
    });

    window.addEventListener("resize", updatePreviewScales);
    if ("ResizeObserver" in window) {
      $$('.preview-frame-wrap, .large-preview').forEach(node => new ResizeObserver(updatePreviewScales).observe(node));
    }

    renderMembers();
    renderScorers();
    renderReferees();
    updateScore();
    updatePreviewScales();
  }

  init();
})();
