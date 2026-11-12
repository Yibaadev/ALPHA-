/* Barre d'accessibilité ALPHA, isolée de la page cible par un Shadow DOM. */
(function () {
  "use strict";

  const NS = (globalThis.ALPHA = globalThis.ALPHA || {});
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
  const alphaMark = () => '<svg class="alpha-mark" viewBox="130 65 235 235" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M145 280 218 80h31l52 141c14-18 22-38 27-58h22c-5 30-17 55-34 75l25 41h-34l-15-18c-15 13-32 20-51 20-24 0-42-10-50-28l-10 27h-36zm63-79h52l-28-69z"/></svg>';

  const CSS = `
    :host {
      all: initial;
      color-scheme: light;
      --ink: #14221d;
      --muted: #53645e;
      --line: #d8e2dd;
      --canvas: #f8faf8;
      --surface: #ffffff;
      --accent: #087263;
      --accent-strong: #065449;
      --accent-soft: #eaf4f0;
      --accent-border: #9ec9bd;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }
    *, *::before, *::after { box-sizing: border-box; }
    button { color: inherit; font: inherit; touch-action: manipulation; }
    button:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
    /* Barre latérale flottante (Floating Dock) */
    .rail {
      position: fixed; top: 14px; right: 12px; z-index: 2147483647; width: 50px;
      display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 7px 4px;
      color: #eef5f1;
      background: rgba(14, 34, 28, 0.94);
      backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 14px;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.26), 0 2px 8px rgba(0, 0, 0, 0.12);
      font: 12px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      transition: box-shadow .2s ease, border-color .2s ease;
    }
    .rail:hover {
      box-shadow: 0 12px 34px rgba(0, 0, 0, 0.32), 0 4px 12px rgba(0, 0, 0, 0.16);
      border-color: rgba(255, 255, 255, 0.22);
    }
    .rail[hidden] { display: none; }
    .rail-brand {
      width: 32px; height: 32px; display: grid; place-items: center;
      border-radius: 8px; color: #34d399; background: rgba(52, 211, 153, 0.12);
      cursor: pointer; transition: background-color .15s ease, transform .15s ease;
    }
    .rail-brand:hover { background: rgba(52, 211, 153, 0.22); transform: scale(1.06); }
    .rail-brand svg { width: 72%; height: 72%; }
    .rail-group { width: 100%; display: flex; flex-direction: column; align-items: center; gap: 4px; }
    .rail-rule { width: 22px; height: 1px; margin: 3px 0; background: rgba(255, 255, 255, 0.12); }
    .rail-button {
      position: relative; width: 38px; height: 38px; padding: 0; display: grid; place-items: center;
      border: 1px solid transparent; border-radius: 9px; color: #b8ccc3;
      background: transparent; cursor: pointer;
      transition: color .15s ease, background-color .15s ease, border-color .15s ease, transform .15s ease;
    }
    .rail-button:hover {
      color: #ffffff; background: rgba(255, 255, 255, 0.12); transform: scale(1.05);
    }
    .rail-button[aria-expanded="true"], .rail-button[data-active="true"] {
      color: #ffffff;
      background: linear-gradient(135deg, #0e8574, #085e50);
      border-color: rgba(255, 255, 255, 0.28);
      box-shadow: 0 2px 10px rgba(8, 114, 99, 0.5);
    }
    .rail-button[aria-expanded="true"]::before, .rail-button[data-active="true"]::before {
      content: ""; position: absolute; left: -4px; top: 50%; transform: translateY(-50%);
      width: 3px; height: 16px; border-radius: 2px; background: #34d399;
    }
    .rail-button svg { width: 19px; height: 19px; }
    .rail-dismiss { color: #8fa69c; }
    .rail-dismiss:hover {
      color: #ff9b9b; background: rgba(239, 68, 68, 0.16); border-color: rgba(239, 68, 68, 0.3);
    }
    .launcher {
      position: fixed; top: 50%; right: 14px; z-index: 2147483647; width: 44px; height: 44px; padding: 0;
      display: grid; place-items: center; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 12px;
      color: #ffffff; background: linear-gradient(135deg, #0b7868, #075043);
      box-shadow: 0 6px 20px rgba(7, 80, 67, 0.38), 0 2px 6px rgba(0, 0, 0, 0.15); cursor: pointer;
      transform: translateY(-50%); transition: transform .18s ease, box-shadow .18s ease;
    }
    .launcher:hover { transform: translateY(-50%) scale(1.06); box-shadow: 0 8px 24px rgba(7, 80, 67, 0.48); }
    .launcher[hidden] { display: none; }
    .launcher svg { width: 70%; height: 70%; }
    .tooltip {
      position: absolute; right: 48px; top: 50%; transform: translateY(-50%) translateX(4px);
      padding: 5px 9px; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 6px;
      color: #f1f7f4; background: #0b1e19;
      box-shadow: 0 4px 14px rgba(0, 0, 0, .35); white-space: nowrap; font-size: 11px; font-weight: 550;
      opacity: 0; pointer-events: none; transition: opacity .15s ease, transform .15s ease;
    }
    .tooltip::after {
      content: ""; position: absolute; right: -4px; top: 50%; transform: translateY(-50%);
      border-left: 4px solid #0b1e19; border-top: 4px solid transparent; border-bottom: 4px solid transparent;
    }
    .rail-button:hover .tooltip, .rail-button:focus-visible .tooltip {
      opacity: 1; transform: translateY(-50%) translateX(0);
    }
    .drawer {
      position: fixed; top: 14px; right: 70px; z-index: 2147483646;
      width: 290px; max-width: calc(100vw - 78px); max-height: calc(100vh - 28px); overflow-y: auto; overflow-x: hidden;
      color: var(--ink); background: var(--canvas); border: 1px solid #cbd7d1; border-radius: 12px;
      box-shadow: 0 12px 34px -4px rgba(15, 38, 32, .18), 0 4px 12px -2px rgba(15, 38, 32, .08);
      font: 12.5px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      scrollbar-color: #a4b4ad transparent; scrollbar-width: thin;
    }
    .drawer[hidden] { display: none; }
    .inner { padding: 14px 14px 16px; }
    .head { display: flex; align-items: center; gap: 9px; margin-bottom: 12px; }
    .brand {
      width: 32px; height: 32px; display: grid; place-items: center; flex: none;
      color: #0b6b55; background: #eef5f2; border: 1px solid #b6ccbf; border-radius: 7px;
    }
    .brand svg { width: 86%; height: 86%; }
    .title { min-width: 0; flex: 1; font-size: 13.5px; font-weight: 750; letter-spacing: .02em; color: var(--ink); }
    .subtitle { display: block; margin-top: 1px; color: var(--muted); font-size: 10px; font-weight: 500; line-height: 1.25; }
    .close {
      width: 28px; height: 28px; display: grid; place-items: center; flex: none;
      border: 1px solid var(--line); border-radius: 6px; color: var(--muted); background: var(--surface); cursor: pointer;
      transition: background-color .14s ease, color .14s ease, border-color .14s ease;
    }
    .close:hover { color: var(--ink); border-color: #a1b8ae; background: #ebf1ee; }
    .close:focus-visible { outline-offset: 1px; }
    .close svg { width: 14px; height: 14px; }
    .section { padding: 12px 0 0; margin-top: 10px; border-top: 1px solid var(--line); }
    .section-heading { margin: 0 0 5px; color: var(--ink); font-size: 12px; font-weight: 700; line-height: 1.3; }
    .section-note { margin: 0 0 8px; color: var(--muted); font-size: 10.5px; line-height: 1.4; }
    .detected-language { color: var(--accent-strong); font-weight: 650; }
    .modes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
    .mode {
      height: 38px; min-height: 38px; padding: 3px 4px; display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 1px;
      border: 1px solid #d0dcd5; border-radius: 7px; color: var(--ink);
      background: var(--surface); cursor: pointer;
      transition: border-color .15s ease, background-color .15s ease, box-shadow .15s ease;
    }
    .mode:hover { border-color: #92ad9f; background: #fdfefd; }
    .mode[aria-pressed="true"] {
      color: #054037; border-color: #0b7868; background: var(--accent-soft);
      box-shadow: inset 0 0 0 1px #0b7868;
    }
    .mode-code { font-size: 12.5px; font-weight: 750; line-height: 1.1; }
    .mode-name { color: var(--muted); font-size: 9.5px; line-height: 1.1; }
    .mode[aria-pressed="true"] .mode-name { color: #0b6b55; font-weight: 600; }
    .reset, .zoom-reset {
      display: block; margin: 8px auto 0; padding: 4px 6px; border: 0;
      color: var(--accent-strong); background: transparent; font-size: 10.5px; font-weight: 600;
      text-decoration: underline; text-underline-offset: 2px; cursor: pointer;
      transition: color .14s ease;
    }
    .reset:hover, .zoom-reset:hover { color: #03362e; }
    .voice-card {
      display: flex; align-items: center; gap: 8px; padding: 8px 9px;
      border: 1px solid var(--line); border-radius: 7px; background: var(--surface);
    }
    .voice-mark {
      width: 28px; height: 28px; flex: none; display: grid; place-items: center;
      color: var(--accent); background: var(--accent-soft); border-radius: 6px;
    }
    .voice-mark svg { width: 16px; height: 16px; }
    .voice-copy { min-width: 0; flex: 1; }
    .voice-title { display: block; font-size: 11.5px; font-weight: 700; color: var(--ink); }
    .voice-hint { display: block; margin-top: 1px; color: var(--muted); font-size: 9.5px; }
    .action {
      min-height: 30px; padding: 5px 11px; border: 1px solid var(--accent); border-radius: 6px;
      color: #fff; background: var(--accent); font-size: 10.5px; font-weight: 700; cursor: pointer;
      transition: background-color .15s ease, border-color .15s ease;
    }
    .action:hover:not(:disabled) { background: var(--accent-strong); border-color: var(--accent-strong); }
    .action:disabled { opacity: .5; cursor: not-allowed; }
    .voice-status { min-height: 15px; margin: 6px 1px 0; color: var(--muted); font-size: 10px; line-height: 1.35; }
    .voice-status[data-state="error"] { color: #9c3333; }
    .voice-status[data-state="notice"] { color: #7a5012; }
    .zoom-card {
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
      padding: 8px 9px; border: 1px solid var(--line); border-radius: 7px; background: var(--surface);
    }
    .zoom-copy { min-width: 0; }
    .zoom-value { display: block; color: var(--ink); font-size: 16px; font-weight: 750; font-variant-numeric: tabular-nums; }
    .zoom-hint { display: block; margin-top: 1px; color: var(--muted); font-size: 9.5px; }
    .zoom-actions { display: flex; align-items: center; gap: 5px; }
    .zoom-control {
      width: 32px; height: 32px; display: grid; place-items: center;
      border: 1px solid #b4c5bc; border-radius: 6px; color: var(--accent-strong);
      background: var(--surface); font-size: 16px; font-weight: 600; cursor: pointer;
      transition: background-color .14s ease, border-color .14s ease;
    }
    .zoom-control:hover:not(:disabled) { background: var(--accent-soft); border-color: #6da295; }
    .zoom-control:disabled { color: #87948f; background: #f2f5f3; opacity: .65; cursor: not-allowed; }
    .zoom-reset { margin: 6px 0 0 auto; }
    @media (max-width: 520px) {
      .rail { right: 8px; top: 10px; width: 44px; padding: 6px 3px; }
      .rail-button { width: 36px; height: 36px; }
      .rail-brand { width: 30px; height: 30px; }
      .drawer { right: 58px; top: 10px; width: 280px; max-width: calc(100vw - 64px); }
      .inner { padding: 12px; }
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
      <nav class="rail" aria-label="Accessibilité ALPHA">
        <div class="rail-brand" role="button" tabindex="0" aria-label="Ouvrir le panneau ALPHA" title="ALPHA">${alphaMark()}</div>
        <span class="rail-rule"></span>
        <div class="rail-group">
          <button class="rail-button" type="button" data-panel="language" aria-label="Langues" aria-expanded="false">${icon("language")}<span class="tooltip">Langues</span></button>
          <button class="rail-button" type="button" data-panel="zoom" aria-label="Agrandir l’affichage">${icon("zoom")}<span class="tooltip">Agrandir</span></button>
          <button class="rail-button" type="button" data-panel="voice" aria-label="Lecture vocale">${icon("speaker")}<span class="tooltip">Lecture vocale</span></button>
        </div>
        <span class="rail-rule"></span>
        <button class="rail-button rail-dismiss" type="button" aria-label="Masquer la barre ALPHA">${icon("close")}<span class="tooltip">Masquer la barre</span></button>
      </nav>
      <button class="launcher" type="button" aria-label="Réafficher la barre ALPHA" title="Réafficher ALPHA" hidden>${alphaMark()}</button>
      <aside class="drawer" aria-label="Langue et accessibilité" hidden>
        <div class="inner">
          <header class="head">
            <span class="brand">${alphaMark()}</span>
            <div class="title">ALPHA<span class="subtitle">Accès financier en langue locale</span></div>
            <button class="close" type="button" aria-label="Fermer le panneau">${icon("close")}</button>
          </header>
          <section class="section" data-section="language">
            <h2 class="section-heading">Langue d’affichage</h2>
            <p class="section-note">Langue détectée : <span class="detected-language">non déterminée</span></p>
            <div class="modes" role="group" aria-label="Choisir la langue d’affichage"></div>
            <button class="reset" type="button">Revenir au texte d’origine</button>
          </section>
          <section class="section" data-section="voice">
            <h2 class="section-heading">Lecture vocale</h2>
            <div class="voice-card">
              <span class="voice-mark">${icon("speaker")}</span>
              <span class="voice-copy"><span class="voice-title">Lecture vocale</span><span class="voice-hint">Lecture du contenu visible</span></span>
              <button class="action speak" type="button">Écouter</button>
            </div>
            <p class="voice-status" aria-live="polite">Lecture avec la voix locale disponible sur l’appareil.</p>
          </section>
          <section class="section" data-section="zoom">
            <h2 class="section-heading">Taille d’affichage</h2>
            <p class="section-note">Ajustez la taille des éléments de la page.</p>
            <div class="zoom-card">
              <span class="zoom-copy"><strong class="zoom-value" aria-live="polite">100 %</strong><span class="zoom-hint">Taille du contenu</span></span>
              <span class="zoom-actions">
                <button class="zoom-control zoom-out" type="button" aria-label="Réduire l’affichage">−</button>
                <button class="zoom-control zoom-in" type="button" aria-label="Agrandir l’affichage">+</button>
              </span>
            </div>
            <button class="zoom-reset" type="button">Rétablir à 100 %</button>
          </section>
        </div>
      </aside>`;

    const drawer = root.querySelector(".drawer");
    const rail = root.querySelector(".rail");
    const launcher = root.querySelector(".launcher");
    const closeButton = root.querySelector(".close");
    const railBrand = root.querySelector(".rail-brand");
    const railButtons = [...root.querySelectorAll(".rail-button[data-panel]")];
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

    function openAt(section) {
      drawer.hidden = false;
      drawer.querySelectorAll("[data-section]").forEach((node) => {
        node.style.display = node.dataset.section === section || section === "language" ? "" : "none";
      });
      railButtons.forEach((button) => {
        const active = button.dataset.panel === section;
        button.setAttribute("aria-expanded", String(active));
        button.dataset.active = String(active);
      });
      if (section === "language") root.querySelector(".close").focus();
      else drawer.querySelector(`[data-section="${section}"]`)?.scrollIntoView({ block: "nearest" });
    }
    function close() {
      drawer.hidden = true;
      railButtons.forEach((button) => {
        button.setAttribute("aria-expanded", "false");
        button.dataset.active = "false";
      });
    }

    railBrand.addEventListener("click", () => openAt("language"));
    railBrand.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openAt("language");
      }
    });

    railButtons.forEach((button) => button.addEventListener("click", () => openAt(button.dataset.panel)));
    root.querySelector(".rail-dismiss").addEventListener("click", () => {
      drawer.hidden = true;
      rail.hidden = true;
      launcher.hidden = false;
      launcher.focus();
    });
    launcher.addEventListener("click", () => {
      launcher.hidden = true;
      rail.hidden = false;
      root.querySelector('.rail-button[data-panel="language"]').focus();
    });
    closeButton.addEventListener("click", () => {
      close();
      root.querySelector('.rail-button[data-panel="language"]').focus();
    });
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
