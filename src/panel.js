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
      font-family: Inter, "Segoe UI", Roboto, Arial, sans-serif;
    }
    *, *::before, *::after { box-sizing: border-box; }
    button { color: inherit; font: inherit; touch-action: manipulation; }
    button:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 3px;
    }
    .rail {
      position: fixed; inset: 0 0 0 auto; z-index: 2147483647; width: 66px;
      display: flex; flex-direction: column; align-items: center; gap: 7px; padding: 14px 8px;
      color: #eef5f1; background: #102923; border-left: 1px solid #28453c;
      box-shadow: -4px 0 16px rgba(17, 33, 28, .12); font: 12px/1.4 Inter, "Segoe UI", Roboto, Arial, sans-serif;
    }
    .rail[hidden] { display: none; }
    .rail-group { width: 100%; display: flex; flex-direction: column; align-items: center; gap: 7px; }
    .rail-rule { width: 30px; height: 1px; margin: 4px 0; background: #52675f; }
    .rail-button {
      position: relative; width: 46px; height: 46px; padding: 11px; display: grid; place-items: center;
      border: 1px solid transparent; border-radius: 9px; color: #cfdbd5;
      background: transparent; cursor: pointer;
      transition: color .18s ease, background-color .18s ease, border-color .18s ease;
    }
    .rail-button:hover { color: #fff; background: #1b3b32; }
    .rail-button[aria-expanded="true"], .rail-button[data-active="true"] {
      color: #f4fffa; background: #1b493e; border-color: #3e7465;
    }
    .rail-button svg { width: 21px; height: 21px; }
    .rail-dismiss { color: #c4d0ca; }
    .rail-dismiss:hover { color: #fff; background: #4b2d2a; border-color: #85554d; }
    .launcher {
      position: fixed; right: 14px; bottom: 16px; z-index: 2147483647; width: 48px; height: 48px;
      display: grid; place-items: center; border: 1px solid #34766a; border-radius: 11px;
      color: #fff; background: #0b6659; box-shadow: 0 5px 16px rgba(17, 33, 28, .2); cursor: pointer;
    }
    .launcher[hidden] { display: none; }
    .launcher svg { width: 22px; height: 22px; }
    .tooltip {
      position: absolute; right: 54px; top: 50%; transform: translateY(-50%); padding: 7px 10px;
      border: 1px solid #ccd7d1; border-radius: 6px; color: var(--ink); background: #fff;
      box-shadow: 0 4px 12px rgba(17, 33, 28, .12); white-space: nowrap;
      opacity: 0; pointer-events: none; transition: opacity .14s ease;
    }
    .rail-button:hover .tooltip, .rail-button:focus-visible .tooltip { opacity: 1; }
    .drawer {
      position: fixed; top: 14px; right: 78px; z-index: 2147483646;
      width: min(390px, calc(100vw - 94px)); max-height: calc(100vh - 28px); overflow: auto;
      color: var(--ink); background: var(--canvas); border: 1px solid #cbd6d0; border-radius: 12px;
      box-shadow: 0 16px 42px rgba(17, 33, 28, .2);
      font: 13px/1.5 Inter, "Segoe UI", Roboto, Arial, sans-serif;
      scrollbar-color: #9caca4 transparent; scrollbar-width: thin;
    }
    .drawer[hidden] { display: none; }
    .inner { padding: 19px 20px 20px; }
    .head { display: flex; align-items: center; gap: 11px; margin-bottom: 15px; }
    .brand {
      width: 38px; height: 38px; display: grid; place-items: center; flex: none;
      color: #e4f2ec; background: #16483d; border: 1px solid #2c6658; border-radius: 9px;
    }
    .brand svg { width: 20px; height: 20px; }
    .title { min-width: 0; flex: 1; font-size: 15px; font-weight: 750; letter-spacing: .015em; }
    .subtitle { display: block; margin-top: 2px; color: var(--muted); font-size: 11px; font-weight: 450; }
    .close {
      width: 36px; height: 36px; display: grid; place-items: center;
      border: 1px solid var(--line); border-radius: 8px; color: var(--ink); background: var(--surface); cursor: pointer;
    }
    .close:hover { border-color: #93aaa0; background: #f0f4f1; }
    .close:focus-visible { outline-offset: 1px; }
    .close svg { width: 17px; height: 17px; }
    .section { padding: 15px 0; border-top: 1px solid var(--line); }
    .section-heading { margin: 0 0 8px; color: var(--ink); font-size: 14px; font-weight: 700; line-height: 1.3; }
    .section-note { margin: 0 0 11px; color: var(--muted); font-size: 11px; line-height: 1.5; }
    .detected-language { color: var(--accent-strong); font-weight: 700; }
    .modes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .mode {
      min-height: 64px; padding: 8px 4px; display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 3px;
      border: 1px solid #cfd9d3; border-radius: 8px; color: var(--ink);
      background: var(--surface); cursor: pointer;
      transition: border-color .16s ease, background-color .16s ease;
    }
    .mode:hover { border-color: #8ca69b; background: #fbfcfb; }
    .mode[aria-pressed="true"] {
      color: #123f35; border-color: #16806e; background: var(--accent-soft);
      box-shadow: inset 0 0 0 1px #16806e;
    }
    .mode-code { font-size: 15px; font-weight: 750; }
    .mode-name { color: var(--muted); font-size: 10px; }
    .reset, .zoom-reset {
      display: block; margin: 8px auto 0; padding: 5px 7px; border: 0;
      color: var(--accent-strong); background: transparent; font-size: 11px;
      text-decoration: underline; text-underline-offset: 2px; cursor: pointer;
    }
    .reset:hover, .zoom-reset:hover { color: #063e35; }
    .confidence-legend {
      margin-top: 14px; padding: 13px 0 0; border: 0; border-top: 1px solid var(--line);
      border-radius: 0; background: transparent;
    }
    .confidence-title { margin: 0 0 9px; color: var(--ink); font-size: 12px; font-weight: 700; }
    .confidence-list { display: grid; gap: 7px; margin: 0; padding: 0; list-style: none; }
    .confidence-item {
      display: grid; grid-template-columns: 112px minmax(0, 1fr); align-items: start; gap: 8px;
      color: var(--ink); font-size: 11px; line-height: 1.4;
    }
    .confidence-chip {
      display: inline-flex; align-items: center; gap: 6px; width: max-content; max-width: 100%;
      padding: 0; border: 0; border-radius: 0; color: var(--ink); background: transparent;
      font-size: 11px; font-weight: 700;
    }
    .confidence-chip::before {
      content: ""; width: 7px; height: 7px; flex: none; border-radius: 50%; background: currentColor;
    }
    .confidence-chip[data-status="valide"] { color: #17634e; }
    .confidence-chip[data-status="probable"] { color: #805811; }
    .confidence-chip[data-status="automatique"] { color: #994e1d; }
    .confidence-chip[data-status="non_traduit"] { color: #9b3f40; }
    .confidence-note {
      margin: 10px 0 0; padding: 8px 10px; border-left: 3px solid #a97720;
      border-radius: 0 6px 6px 0; color: var(--warning-ink); background: #f3eee2;
      font-size: 11px; line-height: 1.45;
    }
    .confidence-summary { margin: 9px 0 0; color: var(--muted); font-size: 10.5px; line-height: 1.45; }
    .voice-card {
      display: flex; align-items: center; gap: 10px; padding: 10px 11px;
      border: 1px solid var(--line); border-radius: 8px; background: var(--surface);
    }
    .voice-mark {
      width: 34px; height: 34px; flex: none; display: grid; place-items: center;
      color: var(--accent); background: var(--accent-soft); border-radius: 7px;
    }
    .voice-mark svg { width: 19px; height: 19px; }
    .voice-copy { min-width: 0; flex: 1; }
    .voice-title { display: block; font-weight: 700; }
    .voice-hint { display: block; margin-top: 2px; color: var(--muted); font-size: 10.5px; }
    .action {
      min-height: 40px; padding: 8px 13px; border: 1px solid var(--accent-strong); border-radius: 7px;
      color: #fff; background: var(--accent-strong); font-size: 11px; font-weight: 700; cursor: pointer;
      transition: background-color .16s ease, border-color .16s ease;
    }
    .action:hover:not(:disabled) { background: #06483f; border-color: #06483f; }
    .action:disabled { opacity: .5; cursor: not-allowed; }
    .voice-status { min-height: 16px; margin: 8px 1px 0; color: var(--muted); font-size: 11px; }
    .voice-status[data-state="error"] { color: #9b3737; }
    .voice-status[data-state="notice"] { color: #765215; }
    .user-notice {
      padding: 10px 11px; border: 0; border-left: 3px solid #a97720;
      border-radius: 0 6px 6px 0; color: var(--warning-ink); background: #f3eee2;
      font-size: 11px; line-height: 1.5;
    }
    .zoom-card {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      padding: 10px 11px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface);
    }
    .zoom-copy { min-width: 0; }
    .zoom-value { display: block; color: var(--ink); font-size: 18px; font-weight: 750; font-variant-numeric: tabular-nums; }
    .zoom-hint { display: block; margin-top: 2px; color: var(--muted); font-size: 10.5px; }
    .zoom-actions { display: flex; align-items: center; gap: 7px; }
    .zoom-control {
      width: 40px; height: 40px; display: grid; place-items: center;
      border: 1px solid #a9bcb3; border-radius: 7px; color: var(--accent-strong);
      background: var(--surface); font-size: 19px; font-weight: 600; cursor: pointer;
    }
    .zoom-control:hover:not(:disabled) { background: var(--accent-soft); border-color: #5e9687; }
    .zoom-control:disabled { color: #78857f; background: #f0f3f1; opacity: .65; cursor: not-allowed; }
    .zoom-reset { margin: 7px 0 0 auto; }
    @media (max-width: 520px) {
      .rail { width: 54px; padding-inline: 5px; }
      .rail-button { width: 42px; height: 42px; }
      .drawer { right: 62px; width: min(390px, calc(100vw - 74px)); }
      .inner { padding: 16px; }
      .confidence-item { grid-template-columns: 104px minmax(0, 1fr); gap: 6px; }
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
      <nav class="rail" aria-label="Accessibilité SAFINUM">
        <div class="rail-group">
          <button class="rail-button rail-dismiss" type="button" aria-label="Masquer la barre SAFINUM">${icon("close")}<span class="tooltip">Masquer la barre</span></button>
          <span class="rail-rule"></span>
          <button class="rail-button" type="button" data-panel="language" aria-label="Langue et écoute" aria-expanded="false">${icon("language")}<span class="tooltip">Langue et écoute</span></button>
          <button class="rail-button" type="button" data-panel="zoom" aria-label="Agrandir l’affichage">${icon("zoom")}<span class="tooltip">Agrandir l’affichage</span></button>
          <button class="rail-button" type="button" data-panel="voice" aria-label="Lecture vocale">${icon("speaker")}<span class="tooltip">Lecture vocale</span></button>
        </div>
      </nav>
      <button class="launcher" type="button" aria-label="Réafficher la barre SAFINUM" title="Réafficher SAFINUM" hidden>${icon("language")}</button>
      <aside class="drawer" aria-label="Langue et accessibilité" hidden>
        <div class="inner">
          <header class="head">
            <span class="brand">${icon("language")}</span>
            <div class="title">SAFINUM<span class="subtitle">Accès financier en langue nationale</span></div>
            <button class="close" type="button" aria-label="Fermer le panneau">${icon("close")}</button>
          </header>
          <section class="section" data-section="language">
            <h2 class="section-heading">Langue d’affichage</h2>
            <p class="section-note">Langue détectée sur la page : <span class="detected-language">non déterminée</span>. Choisissez la langue d’affichage.</p>
            <div class="modes" role="group" aria-label="Choisir la langue d’affichage"></div>
            <button class="reset" type="button">Revenir au texte d’origine</button>
            <section class="confidence-legend" aria-labelledby="confidence-title">
              <h3 class="confidence-title" id="confidence-title">Fiabilité des traductions</h3>
              <ul class="confidence-list">
                <li class="confidence-item"><span class="confidence-chip" data-status="valide">Valide</span><span>Vérifiée par une personne.</span></li>
                <li class="confidence-item"><span class="confidence-chip" data-status="probable">Probable</span><span>Proposition non vérifiée; le français reste visible.</span></li>
                <li class="confidence-item"><span class="confidence-chip" data-status="automatique">Automatique</span><span>Contenu non vérifié; le français reste visible.</span></li>
                <li class="confidence-item"><span class="confidence-chip" data-status="non_traduit">Non traduit</span><span>Le texte d’origine est conservé.</span></li>
              </ul>
              <p class="confidence-note">Pour les propositions non vérifiées : vérifiez les montants avant de continuer.</p>
              <p class="confidence-summary" aria-live="polite" hidden></p>
            </section>
          </section>
          <section class="section" data-section="voice">
            <h2 class="section-heading">Écouter les informations affichées</h2>
            <div class="voice-card">
              <span class="voice-mark">${icon("speaker")}</span>
              <span class="voice-copy"><span class="voice-title">Lecture vocale</span><span class="voice-hint">Lecture locale du contenu visible</span></span>
              <button class="action speak" type="button">Écouter</button>
            </div>
            <p class="voice-status" aria-live="polite">La lecture utilise une voix locale disponible sur l’appareil.</p>
          </section>
          <section class="section" data-section="zoom">
            <h2 class="section-heading">Agrandir l’affichage</h2>
            <p class="section-note">Ajustez la taille des éléments de la page pour mieux les lire.</p>
            <div class="zoom-card">
              <span class="zoom-copy"><strong class="zoom-value" aria-live="polite">100 %</strong><span class="zoom-hint">Taille du contenu</span></span>
              <span class="zoom-actions">
                <button class="zoom-control zoom-out" type="button" aria-label="Réduire l’affichage">−</button>
                <button class="zoom-control zoom-in" type="button" aria-label="Agrandir l’affichage">+</button>
              </span>
            </div>
            <button class="zoom-reset" type="button">Rétablir la taille initiale</button>
          </section>
          <section class="section" data-section="notice" hidden>
            <p class="user-notice" role="status" aria-live="polite"></p>
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
        const notice = root.querySelector('[data-section="notice"]');
        const confidence = stats.confidence || {};
        const unverified = (confidence.probable || 0) + (confidence.automatique || 0);
        const confidenceSummary = root.querySelector(".confidence-summary");
        confidenceSummary.hidden = currentMode !== "local";
        confidenceSummary.textContent = currentMode === "local"
          ? `Valide : ${confidence.valide || 0} · Probable : ${confidence.probable || 0} · Automatique : ${confidence.automatique || 0} · Non traduit : ${confidence.non_traduit || 0}`
          : "";
        const needsAttention = currentMode !== "original" &&
          (stats.pending > 0 || stats.unknown > 0 || stats.failed > 0 || unverified > 0);
        notice.hidden = !needsAttention;
        if (stats.failed > 0) {
          notice.querySelector(".user-notice").textContent =
            "Une vérification a échoué. Le texte concerné reste dans sa langue d’origine; comprenez-le avant de continuer.";
        } else if (currentMode === "local" && unverified > 0) {
          notice.querySelector(".user-notice").textContent =
            "Traduction non vérifiée, vérifiez les montants avant de continuer. Le texte français reste affiché à côté.";
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
