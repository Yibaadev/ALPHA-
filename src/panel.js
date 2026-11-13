/* Barre d'accessibilité SAFINUM, isolée de la page cible par un Shadow DOM. */
(function () {
  "use strict";

  const NS = (globalThis.SAFINUM = globalThis.SAFINUM || {});
  const MODES = [
    { id: "fr", code: "FR", label: "Français" },
    { id: "en", code: "EN", label: "English" },
    { id: "local", code: "ET", label: "Éton" },
  ];

  const ICONS = {
    language: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>',
    zoom: '<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5M10.8 7.8v6M7.8 10.8h6"/>',
    speaker: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
    close: '<path d="m18 6-12 12M6 6l12 12"/>',
  };

  const icon = (name) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[name] + '</svg>';

  const CSS = `

    :host {
      all: initial;
      color-scheme: light;
      --ink: #172621;
      --muted: #4d5d57;
      --line: #d4ddd8;
      --canvas: #f6f8f6;
      --surface: #ffffff;
      --accent: #087263;
      --accent-strong: #07594e;
      --accent-soft: #e6f1ed;
      --warning-ink: #654817;
      --warning-line: #a97720;
      --warning-bg: #f6f0e1;
      --focus-dark: #8fe0cb;
      --text-xs: 12px;
      --text-sm: 13px;
      --text-md: 14px;
      --radius: 10px;
      --ease-out: cubic-bezier(.2, .8, .2, 1);
      font-family: Inter, "Segoe UI", Roboto, Arial, sans-serif;
    }
    *, *::before, *::after { box-sizing: border-box; }
    button { color: inherit; font: inherit; touch-action: manipulation; }
    button:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 3px;
    }
    .rail-button:focus-visible, .launcher:focus-visible { outline-color: var(--focus-dark); outline-offset: 2px; }
    .rail {
      position: fixed; inset: 0 0 0 auto; z-index: 2147483647; width: 58px;
      display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px 7px;
      color: #eef5f1; background: #102923; border-left: 1px solid #28453c;
      box-shadow: -4px 0 16px rgba(17, 33, 28, .12); font: 12px/1.4 Inter, "Segoe UI", Roboto, Arial, sans-serif;
      animation: rail-in .32s var(--ease-out);
    }
    @keyframes rail-in { from { transform: translateX(100%); } to { transform: none; } }
    .rail[hidden] { display: none; }
    .rail-group { width: 100%; display: flex; flex-direction: column; align-items: center; gap: 6px; }
    .rail-rule { width: 26px; height: 1px; margin: 3px 0; background: #52675f; }
    .rail-button {
      position: relative; width: 44px; height: 44px; padding: 11px; display: grid; place-items: center;
      border: 1px solid transparent; border-radius: 10px; color: #cfdbd5;
      background: transparent; cursor: pointer;
      transition: color .18s ease, background-color .18s ease, border-color .18s ease;
    }
    .rail-button:hover { color: #fff; background: #1b3b32; }
    .rail-button[aria-expanded="true"], .rail-button[data-active="true"] {
      color: #f4fffa; background: #1b493e; border-color: #3e7465;
    }
    .rail-button svg { width: 20px; height: 20px; }
    .rail-dismiss { color: #c4d0ca; }
    .rail-dismiss:hover { color: #fff; background: #4b2d2a; border-color: #85554d; }
    .launcher {
      position: fixed; right: 16px; bottom: 20px; z-index: 2147483647; width: 52px; height: 52px;
      display: grid; place-items: center; border: 1px solid #34766a; border-radius: 14px;
      color: #fff; background: #0b6659; box-shadow: 0 8px 22px rgba(17, 33, 28, .24); cursor: pointer;
      animation: launcher-in .6s var(--ease-out) .35s both;
      transition: background-color .18s ease, transform .18s var(--ease-out), box-shadow .18s ease;
    }
    @keyframes launcher-in {
      from { opacity: 0; transform: translateY(18px) scale(.85); }
      to { opacity: 1; transform: none; }
    }
    .launcher[hidden] { display: none; }
    .launcher:hover { background: var(--accent-strong); transform: translateY(-2px); box-shadow: 0 10px 26px rgba(17, 33, 28, .28); }
    .launcher:active { transform: scale(.96); }
    .launcher svg { width: 24px; height: 24px; }
    .tooltip {
      position: absolute; right: 52px; top: 50%; transform: translateY(-50%); padding: 6px 9px;
      border: 1px solid #ccd7d1; border-radius: 6px; color: var(--ink); background: #fff;
      box-shadow: 0 4px 12px rgba(17, 33, 28, .12); white-space: nowrap;
      font-size: var(--text-xs); font-weight: 600;
      opacity: 0; pointer-events: none; transition: opacity .14s ease;
    }
    .rail-button:hover .tooltip, .rail-button:focus-visible .tooltip { opacity: 1; }
    .drawer {
      position: fixed; top: 12px; right: 68px; z-index: 2147483646;
      width: min(296px, calc(100vw - 80px)); max-height: calc(100vh - 24px); overflow: auto;
      color: var(--ink); background: var(--canvas); border: 1px solid #cbd6d0; border-radius: 12px;
      box-shadow: 0 14px 36px rgba(17, 33, 28, .2);
      font: var(--text-sm)/1.45 Inter, "Segoe UI", Roboto, Arial, sans-serif;
      scrollbar-color: #9caca4 transparent; scrollbar-width: thin;
      animation: drawer-in .2s var(--ease-out);
    }
    @keyframes drawer-in { from { opacity: 0; transform: translateX(8px); } to { opacity: 1; transform: none; } }
    .drawer[hidden] { display: none; }
    .inner { padding: 12px 14px 14px; }
    .head { display: flex; align-items: center; gap: 9px; margin-bottom: 10px; }
    .brand {
      width: 30px; height: 30px; display: grid; place-items: center; flex: none;
      color: #e4f2ec; background: #16483d; border: 1px solid #2c6658; border-radius: 8px;
    }
    .brand svg { width: 17px; height: 17px; }
    .title { min-width: 0; flex: 1; font-size: 14px; font-weight: 750; letter-spacing: .01em; line-height: 1.2; }
    .subtitle { display: block; margin-top: 1px; overflow: hidden; color: var(--muted); font-size: var(--text-xs); font-weight: 450; letter-spacing: 0; white-space: nowrap; text-overflow: ellipsis; }
    .close {
      width: 32px; height: 32px; display: grid; place-items: center; flex: none;
      border: 1px solid var(--line); border-radius: 8px; color: var(--ink); background: var(--surface); cursor: pointer;
    }
    .close:hover { border-color: #93aaa0; background: #f0f4f1; }
    .close:focus-visible { outline-offset: 1px; }
    .close svg { width: 15px; height: 15px; }
    .section { padding: 11px 0; border-top: 1px solid var(--line); }
    .section:last-child { padding-bottom: 0; }
    .section-row { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin: 0 0 8px; }
    .section-heading { margin: 0; color: var(--ink); font-size: var(--text-sm); font-weight: 700; line-height: 1.3; }
    .section-meta { color: var(--muted); font-size: var(--text-xs); white-space: nowrap; }
    .detected-language { color: var(--accent-strong); font-weight: 700; }
    .modes {
      display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 3px; padding: 3px;
      border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface);
    }
    .mode {
      min-height: 38px; padding: 4px; display: flex; align-items: center; justify-content: center;
      border: 0; border-radius: 7px; color: var(--muted);
      background: transparent; cursor: pointer;
      transition: color .16s ease, background-color .16s ease;
    }
    .mode:hover { color: var(--ink); background: #f0f4f1; }
    .mode[aria-pressed="true"] { color: #fff; background: var(--accent-strong); }
    .mode-code { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    .mode-name { font-size: var(--text-sm); font-weight: 650; }
    .reset, .zoom-reset {
      min-height: 32px; padding: 4px 6px; border: 0; border-radius: 6px;
      color: var(--accent-strong); background: transparent; font-size: var(--text-xs); font-weight: 600;
      text-decoration: underline; text-underline-offset: 2px; cursor: pointer;
    }
    .reset { display: block; margin: 4px 0 0 auto; }
    .reset:hover, .zoom-reset:hover { color: #063e35; }
    .row-card {
      display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 7px 7px 7px 11px;
      border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface);
    }
    .voice-hint { min-width: 0; color: var(--muted); font-size: var(--text-xs); }
    .action {
      min-height: 34px; padding: 6px 14px; flex: none; border: 1px solid var(--accent-strong); border-radius: 8px;
      color: #fff; background: var(--accent-strong); font-size: var(--text-xs); font-weight: 700; cursor: pointer;
      transition: background-color .16s ease, border-color .16s ease;
    }
    .action:hover:not(:disabled) { background: #06483f; border-color: #06483f; }
    .action:disabled { opacity: .5; cursor: not-allowed; }
    .voice-status { margin: 6px 1px 0; color: var(--muted); font-size: var(--text-xs); }
    .voice-status:empty { display: none; }
    .voice-status[data-state="error"] { color: #9b3737; }
    .voice-status[data-state="notice"] { color: #765215; }
    .user-notice {
      margin: 0; padding: 8px 10px; border: 0; border-left: 3px solid var(--warning-line);
      border-radius: 0 6px 6px 0; color: var(--warning-ink); background: var(--warning-bg);
      font-size: var(--text-xs); font-weight: 600; line-height: 1.45;
    }
    .zoom-value { color: var(--ink); font-size: 16px; font-weight: 750; font-variant-numeric: tabular-nums; }
    .zoom-actions { display: flex; align-items: center; gap: 4px; }
    .zoom-control {
      width: 34px; height: 34px; display: grid; place-items: center;
      border: 1px solid #a9bcb3; border-radius: 8px; color: var(--accent-strong);
      background: var(--surface); font-size: 17px; font-weight: 600; cursor: pointer;
    }
    .zoom-control:hover:not(:disabled) { background: var(--accent-soft); border-color: #5e9687; }
    .zoom-control:disabled { color: #78857f; background: #f0f3f1; opacity: .65; cursor: not-allowed; }
    .zoom-reset { text-decoration: none; }
    @media (max-width: 520px) {
      .rail { width: 52px; padding-inline: 4px; }
      .drawer { right: 60px; width: min(296px, calc(100vw - 72px)); }
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { scroll-behavior: auto !important; transition-duration: .01ms !important; animation-duration: .01ms !important; animation-iteration-count: 1 !important; }
    }

  `;

  function create({ hostId, onModeChange, onSpeak, onZoomChange }) {
    const host = document.createElement("div");
    host.id = hostId;
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>${CSS}</style>
      <nav class="rail" aria-label="Accessibilité SAFINUM" hidden>
        <div class="rail-group">
          <button class="rail-button rail-dismiss" type="button" aria-label="Masquer la barre SAFINUM">${icon("close")}<span class="tooltip">Masquer la barre</span></button>
          <span class="rail-rule" aria-hidden="true"></span>
          <button class="rail-button" type="button" data-panel="language" aria-label="Langue et écoute" aria-controls="safinum-drawer" aria-expanded="false">${icon("language")}<span class="tooltip">Langue et écoute</span></button>
          <button class="rail-button" type="button" data-panel="zoom" aria-label="Agrandir l’affichage" aria-controls="safinum-drawer" aria-expanded="false">${icon("zoom")}<span class="tooltip">Agrandir l’affichage</span></button>
          <button class="rail-button" type="button" data-panel="voice" aria-label="Lecture vocale" aria-controls="safinum-drawer" aria-expanded="false">${icon("speaker")}<span class="tooltip">Lecture vocale</span></button>
        </div>
      </nav>
      <button class="launcher" type="button" aria-label="Ouvrir SAFINUM" title="SAFINUM">${icon("language")}</button>
      <aside class="drawer" id="safinum-drawer" aria-label="Langue et accessibilité" hidden>
        <div class="inner">
          <header class="head">
            <span class="brand" aria-hidden="true">${icon("language")}</span>
            <div class="title">SAFINUM<span class="subtitle">En langue nationale</span></div>
            <button class="close" type="button" aria-label="Fermer le panneau">${icon("close")}</button>
          </header>
          <section class="section" data-section="notice" hidden>
            <p class="user-notice" role="status" aria-live="polite"></p>
          </section>
          <section class="section" data-section="language">
            <div class="section-row">
              <h2 class="section-heading">Langue d’affichage</h2>
              <span class="section-meta">Page : <span class="detected-language">non déterminée</span></span>
            </div>
            <div class="modes" role="group" aria-label="Choisir la langue d’affichage"></div>
            <button class="reset" type="button">Revenir au texte d’origine</button>
          </section>
          <section class="section" data-section="voice">
            <div class="section-row"><h2 class="section-heading">Lecture vocale</h2></div>
            <div class="row-card">
              <span class="voice-hint">Lit le contenu visible avec une voix de l’appareil</span>
              <button class="action speak" type="button">Écouter</button>
            </div>
            <p class="voice-status" aria-live="polite"></p>
          </section>
          <section class="section" data-section="zoom">
            <div class="section-row">
              <h2 class="section-heading">Taille de l’affichage</h2>
              <button class="zoom-reset" type="button">Rétablir</button>
            </div>
            <div class="row-card">
              <strong class="zoom-value" aria-live="polite">100 %</strong>
              <span class="zoom-actions">
                <button class="zoom-control zoom-out" type="button" aria-label="Réduire l’affichage">−</button>
                <button class="zoom-control zoom-in" type="button" aria-label="Agrandir l’affichage">+</button>
              </span>
            </div>
          </section>
        </div>
      </aside>`;

    const drawer = root.querySelector(".drawer");
    const rail = root.querySelector(".rail");
    const launcher = root.querySelector(".launcher");
    const closeButton = root.querySelector(".close");
    const railButtons = [...root.querySelectorAll(".rail-button")];
    const modesContainer = root.querySelector(".modes");
    const modeButtons = MODES.map((mode) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "mode";
      button.dataset.mode = mode.id;
      button.setAttribute("aria-pressed", "false");
      button.innerHTML = '<span class="mode-code"></span><span class="mode-name"></span>';
      button.querySelector(".mode-code").textContent = mode.code;
      button.querySelector(".mode-name").textContent = mode.label;
      button.addEventListener("click", () => onModeChange(mode.id));
      modesContainer.appendChild(button);
      return button;
    });

    let openSection = null;
    let lastTrigger = null;
    function openAt(section) {
      openSection = section;
      drawer.hidden = false;
      drawer.querySelectorAll("[data-section]").forEach((node) => {
        node.style.display = node.dataset.section === section || section === "language" ? "" : "none";
      });
      railButtons.forEach((button) => {
        const active = button.dataset.panel === section;
        button.setAttribute("aria-expanded", String(active));
        button.dataset.active = String(active);
      });
      const target = drawer.querySelector(`[data-section="${section}"]`);
      if (section === "language") closeButton.focus();
      else {
        target?.scrollIntoView({ block: "nearest" });
        target?.querySelector("button:not(:disabled)")?.focus();
      }
    }
    function close() {
      openSection = null;
      drawer.hidden = true;
      railButtons.forEach((button) => {
        button.setAttribute("aria-expanded", "false");
        button.dataset.active = "false";
      });
    }

    function closeAndReturnFocus() {
      const trigger = lastTrigger || root.querySelector('.rail-button[data-panel="language"]');
      close();
      trigger.focus();
    }
    railButtons.forEach((button) => button.addEventListener("click", () => {
      if (!button.dataset.panel) return;
      lastTrigger = button;
      if (openSection === button.dataset.panel && !drawer.hidden) close();
      else openAt(button.dataset.panel);
    }));
    root.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !drawer.hidden) {
        event.stopPropagation();
        closeAndReturnFocus();
      }
    });
    root.querySelector(".rail-dismiss").addEventListener("click", () => {
      close();
      rail.hidden = true;
      launcher.hidden = false;
      launcher.focus();
    });
    launcher.addEventListener("click", () => {
      launcher.hidden = true;
      rail.hidden = false;
      root.querySelector('.rail-button[data-panel="language"]').focus();
    });
    closeButton.addEventListener("click", closeAndReturnFocus);
    root.querySelector(".reset").addEventListener("click", () => onModeChange("original"));
    root.querySelector(".speak").addEventListener("click", onSpeak);
    let zoomPercent = 100;
    const zoomValue = root.querySelector(".zoom-value");
    const zoomOut = root.querySelector(".zoom-out");
    const zoomIn = root.querySelector(".zoom-in");
    zoomOut.disabled = true;
    function updateZoom(next) {
      zoomPercent = Math.max(100, Math.min(200, next));
      zoomValue.textContent = `${zoomPercent} %`;
      zoomOut.disabled = zoomPercent === 100;
      zoomIn.disabled = zoomPercent === 200;
      onZoomChange(zoomPercent);
    }
    zoomOut.addEventListener("click", () => updateZoom(zoomPercent <= 150 ? zoomPercent - 10 : zoomPercent - 25));
    zoomIn.addEventListener("click", () => updateZoom(zoomPercent < 150 ? zoomPercent + 10 : zoomPercent + 25));
    root.querySelector(".zoom-reset").addEventListener("click", () => updateZoom(100));
    document.documentElement.appendChild(host);

    return {
      update(stats, currentMode, detectedLanguage) {
        modeButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.mode === currentMode)));
        const detectedLabel = detectedLanguage === "fr"
          ? "français"
          : detectedLanguage === "en" ? "anglais" : "non déterminée";
        root.querySelector(".detected-language").textContent = detectedLabel;
        const notice = root.querySelector('[data-section="notice"]');
        const confidence = stats.confidence || {};
        const unverified = (confidence.probable || 0) + (confidence.automatique || 0);
        const needsAttention = currentMode !== "original" &&
          (stats.pending > 0 || stats.unknown > 0 || stats.failed > 0 || unverified > 0);
        notice.hidden = !needsAttention;
        if (stats.failed > 0) {
          notice.querySelector(".user-notice").textContent =
            "Une vérification a échoué. Le texte concerné reste dans sa langue d’origine; comprenez-le avant de continuer.";
        } else if (currentMode === "local" && unverified > 0) {
          notice.querySelector(".user-notice").textContent =
            "Certaines traductions ne sont pas encore vérifiées. Vérifiez les montants avant de continuer.";
        } else if (needsAttention) {
          notice.querySelector(".user-notice").textContent =
            "Certains textes restent dans leur langue d’origine. Assurez-vous de les comprendre avant de continuer.";
        }
      },
      setVoiceStatus(message) {
        const status = root.querySelector(".voice-status");
        status.textContent = message;
        const lower = message.toLowerCase();
        status.dataset.state = /échec|aucune voix|n’est pas disponible/.test(lower)
          ? "error"
          : /désactivée|en attendant|indisponible/.test(lower) ? "notice" : "";
      },
      setSpeaking(speaking) {
        const button = root.querySelector(".speak");
        button.textContent = speaking ? "Arrêter" : "Écouter";
        button.setAttribute("aria-pressed", String(speaking));
      },
      updateZoom,
      openAt,
    };
  }

  NS.panel = { create };
})();
