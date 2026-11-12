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
    :host { all: initial; color-scheme: dark; --panel:#151a1b; --panel-raised:#202829;
      --border:#343e3f; --text:#f3f7f7; --muted:#a5b2b4; --accent:#7de0c9;
      --accent-soft:#203b36; --warning:#f4c76b; }
    *,*::before,*::after { box-sizing:border-box; }
    button { color:inherit; font:inherit; }
    .rail { position:fixed; inset:0 0 0 auto; z-index:2147483647; width:66px;
      display:flex; flex-direction:column; align-items:center; gap:7px; padding:14px 8px;
      color:var(--text); background:linear-gradient(180deg,#1a2021 0%,#141819 100%);
      border-left:1px solid #303a3b; box-shadow:-8px 0 24px #0003; font:12px/1.4 system-ui,sans-serif; }
    .rail[hidden] { display:none; }
    .rail-group { width:100%; display:flex; flex-direction:column; align-items:center; gap:7px; }
    .rail-rule { width:32px; height:1px; margin:3px 0 4px; background:#42494a; }
    .rail-button { position:relative; width:46px; height:46px; padding:11px; display:grid;
      place-items:center; border:1px solid transparent; border-radius:13px; color:#aeb9bc;
      background:transparent; cursor:pointer; transition:color .16s,background .16s,border-color .16s,transform .16s; }
    .rail-button:hover { color:#f5fffc; background:#283232; transform:translateY(-1px); }
    .rail-button[aria-expanded="true"],.rail-button[data-active="true"] {
      color:var(--accent); background:var(--accent-soft); border-color:#31554e; }
    .rail-button svg { width:22px; height:22px; }
    .rail-dismiss { color:#95a2a5; }
    .rail-dismiss:hover { color:#ffb2ae; background:#382b2b; border-color:#63403f; }
    .launcher { position:fixed; right:14px; bottom:16px; z-index:2147483647; width:48px; height:48px;
      display:grid; place-items:center; border:1px solid #42645c; border-radius:15px; color:var(--accent);
      background:linear-gradient(145deg,#29443e,#1c302d); box-shadow:0 8px 24px #0006; cursor:pointer; }
    .launcher[hidden] { display:none; }
    .launcher svg { width:23px; height:23px; }
    .launcher:focus-visible { outline:2px solid var(--accent); outline-offset:3px; }
    .rail-button:focus-visible,.mode:focus-visible,.action:focus-visible,.close:focus-visible,.zoom-control:focus-visible {
      outline:2px solid var(--accent); outline-offset:2px; }
    .tooltip { position:absolute; right:54px; top:50%; transform:translateY(-50%); padding:7px 10px;
      border:1px solid #3d4849; border-radius:8px; color:var(--text); background:#202728;
      box-shadow:0 6px 18px #0005; white-space:nowrap; opacity:0; pointer-events:none; transition:opacity .12s; }
    .rail-button:hover .tooltip,.rail-button:focus-visible .tooltip { opacity:1; }
    .drawer { position:fixed; top:14px; right:78px; z-index:2147483646; width:min(368px,calc(100vw - 94px));
      max-height:calc(100vh - 28px); overflow:auto; color:var(--text);
      background:linear-gradient(155deg,#1b2223 0%,#151a1b 58%); border:1px solid #364142;
      border-radius:16px; box-shadow:0 18px 52px #0008;
      font:13px/1.5 system-ui,sans-serif; }
    .drawer[hidden] { display:none; }
    .inner { padding:18px; }
    .head { display:flex; align-items:center; gap:11px; margin-bottom:18px; }
    .brand { width:36px; height:36px; display:grid; place-items:center; flex:none; color:var(--accent);
      background:linear-gradient(145deg,#29443e,#1c302d); border:1px solid #42645c; border-radius:12px;
      box-shadow:inset 0 1px #ffffff16; }
    .brand svg { width:20px;height:20px; }
    .title { min-width:0; flex:1; font-size:16px; font-weight:760; letter-spacing:.015em; }
    .subtitle { display:block; margin-top:2px; color:var(--muted); font-size:10px; font-weight:450; }
    .close { width:32px;height:32px;display:grid;place-items:center;border:1px solid var(--border);
      border-radius:9px;color:var(--muted);background:var(--panel-raised);cursor:pointer; }
    .close svg { width:17px;height:17px; }
    .section { padding:15px 0; border-top:1px solid #343e3f; }
    .section-heading { margin:0 0 9px; color:#f0f5f5; font-size:13px; font-weight:720; letter-spacing:.005em; }
    .section-note { margin:0 0 11px; color:var(--muted); font-size:10px; }
    .detected-language { color:#e4f1ee; font-weight:650; }
    .modes { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:7px; }
    .mode { min-height:66px; padding:8px 4px; display:flex; flex-direction:column; align-items:center;
      justify-content:center; gap:4px; border:1px solid #3a4546; border-radius:12px;
      color:#d9e1e2; background:linear-gradient(145deg,#252d2e,#202627); cursor:pointer;
      transition:border-color .15s,background .15s,transform .15s; }
    .mode:hover { border-color:#526564; transform:translateY(-1px); }
    .mode[aria-pressed="true"] { color:#f4fffc; border-color:#73cdb7; background:linear-gradient(145deg,#294840,#223a35);
      box-shadow:inset 0 0 0 1px #73cdb744,0 4px 14px #0002; }
    .mode-code { font-size:15px; font-weight:800; }
    .mode-name { color:var(--muted); font-size:9px; }
    .reset { display:block; margin:8px auto 0; padding:4px; border:0; color:#b9c6c9;
      background:transparent; font-size:10px; text-decoration:underline; cursor:pointer; }
    .confidence-legend { margin-top:13px; padding:11px; border:1px solid #3b4848; border-radius:12px;
      background:linear-gradient(130deg,#252f30,#1e2526); }
    .confidence-title { margin:0 0 8px; color:#f0f5f5; font-size:11px; font-weight:750; }
    .confidence-list { display:grid; gap:7px; margin:0; padding:0; list-style:none; }
    .confidence-item { display:grid; grid-template-columns:106px 1fr; align-items:start; gap:7px;
      color:#e6eeee; font-size:10px; line-height:1.4; }
    .confidence-chip { display:inline-block; width:max-content; max-width:100%; padding:2px 5px;
      border:1px solid transparent; border-radius:999px; font-size:9px; font-weight:800; }
    .confidence-chip[data-status="valide"] { color:#d1fae5; background:#173d30; border-color:#317454; }
    .confidence-chip[data-status="probable"] { color:#fff1c2; background:#493b18; border-color:#917328; }
    .confidence-chip[data-status="automatique"] { color:#ffdfc2; background:#4b2c1b; border-color:#a95d31; }
    .confidence-chip[data-status="non_traduit"] { color:#ffd6d4; background:#4a2526; border-color:#a44a4c; }
    .confidence-note { margin:9px 0 0; color:#f5dfa9; font-size:10px; line-height:1.45; }
    .confidence-summary { margin:8px 0 0; color:#d7e3e2; font-size:10px; }
    .voice-card { display:flex; align-items:center; gap:10px; padding:11px;
      border:1px solid #3b4848; border-radius:13px; background:linear-gradient(120deg,#252f30,#202728);
      box-shadow:inset 0 1px #ffffff08; }
    .voice-mark { width:36px;height:36px;flex:none;display:grid;place-items:center;color:var(--accent);
      background:var(--accent-soft);border:1px solid #34534c;border-radius:11px; }
    .voice-mark svg { width:20px;height:20px; }
    .voice-copy { min-width:0; flex:1; }
    .voice-title { display:block; font-weight:700; }
    .voice-hint { display:block; margin-top:2px; color:var(--muted); font-size:9px; }
    .action { min-height:36px; padding:7px 12px; border:1px solid #54736b; border-radius:9px;
      color:#effbf7; background:linear-gradient(145deg,#315249,#273f39); font-size:10px; font-weight:720;
      cursor:pointer; transition:filter .15s,transform .15s; }
    .action:hover:not(:disabled) { filter:brightness(1.13); transform:translateY(-1px); }
    .action:disabled { opacity:.48; cursor:not-allowed; }
    .voice-status { min-height:15px; margin:8px 2px 0; color:var(--muted); font-size:10px; }
    .voice-status[data-state="error"] { color:#ffaaa7; }
    .voice-status[data-state="notice"] { color:#f2d18a; }
    .user-notice { padding:11px 12px; border:1px solid #735f36; border-radius:11px;
      color:#f5dfa9; background:#302a1e; font-size:11px; line-height:1.5; }
    .zoom-card { display:flex; align-items:center; justify-content:space-between; gap:12px;
      padding:11px; border:1px solid #3b4848; border-radius:13px; background:linear-gradient(120deg,#252f30,#202728); }
    .zoom-copy { min-width:0; }
    .zoom-value { display:block; color:#f5faf9; font-size:18px; font-weight:750; font-variant-numeric:tabular-nums; }
    .zoom-hint { display:block; margin-top:2px; color:var(--muted); font-size:9px; }
    .zoom-actions { display:flex; align-items:center; gap:6px; }
    .zoom-control { width:36px; height:36px; display:grid; place-items:center; border:1px solid #54736b;
      border-radius:9px; color:#effbf7; background:#2b423c; font-size:19px; font-weight:650; cursor:pointer; }
    .zoom-control:disabled { opacity:.42; cursor:not-allowed; }
    .zoom-reset { display:block; margin:7px 0 0 auto; padding:4px 2px; border:0; color:#b9c6c9;
      background:transparent; font-size:10px; text-decoration:underline; cursor:pointer; }
    @media(max-width:520px) { .rail { width:54px; padding-inline:5px; } .rail-button { width:42px;height:42px; }
      .drawer { right:62px; width:min(368px,calc(100vw - 74px)); } }
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
                <li class="confidence-item"><span class="confidence-chip" data-status="valide">🟢 Valide</span><span>Entrée vérifiée par une personne.</span></li>
                <li class="confidence-item"><span class="confidence-chip" data-status="probable">🟡 Probable</span><span>Non vérifiée; le français reste visible.</span></li>
                <li class="confidence-item"><span class="confidence-chip" data-status="automatique">🟠 Automatique</span><span>Non vérifiée; le français reste visible.</span></li>
                <li class="confidence-item"><span class="confidence-chip" data-status="non_traduit">🔴 Non traduit</span><span>Le texte original est conservé.</span></li>
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
