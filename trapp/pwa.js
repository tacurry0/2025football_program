(function () {
  "use strict";

  const installButton = document.getElementById("menu-install");
  const installGuide = document.getElementById("pwa-install-guide");
  let deferredInstallPrompt = null;
  let guidePreviouslyFocused = null;

  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches
    || window.navigator.standalone === true;

  function setInstallButtonVisible(visible) {
    if (!installButton) return;
    installButton.hidden = !visible || isStandalone();
  }

  function openInstallGuide() {
    if (!installGuide) return;
    guidePreviouslyFocused = document.activeElement;
    installGuide.hidden = false;
    document.body.classList.add("pwa-guide-open");
    installGuide.querySelector(".pwa-install-guide-close")?.focus();
  }

  function closeInstallGuide() {
    if (!installGuide || installGuide.hidden) return;
    installGuide.hidden = true;
    document.body.classList.remove("pwa-guide-open");
    guidePreviouslyFocused?.focus?.();
  }

  if (!isStandalone() && isIos) {
    setInstallButtonVisible(true);
  }

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    setInstallButtonVisible(true);
  });

  installButton?.addEventListener("click", async () => {
    if (deferredInstallPrompt) {
      const promptEvent = deferredInstallPrompt;
      deferredInstallPrompt = null;
      setInstallButtonVisible(false);

      try {
        await promptEvent.prompt();
        await promptEvent.userChoice;
      } catch (error) {
        console.error("PWAのインストール画面を開けませんでした。", error);
      }
      return;
    }

    if (isIos) {
      openInstallGuide();
    }
  });

  installGuide?.querySelectorAll("[data-pwa-guide-close]").forEach(element => {
    element.addEventListener("click", closeInstallGuide);
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeInstallGuide();
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    setInstallButtonVisible(false);
    closeInstallGuide();
  });

  const displayMode = window.matchMedia("(display-mode: standalone)");
  displayMode.addEventListener?.("change", () => {
    if (isStandalone()) {
      setInstallButtonVisible(false);
      closeInstallGuide();
    }
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", async () => {
      try {
        await navigator.serviceWorker.register("./sw.js", { scope: "./" });
      } catch (error) {
        console.error("Service Workerの登録に失敗しました。", error);
      }
    }, { once: true });
  }
})();
