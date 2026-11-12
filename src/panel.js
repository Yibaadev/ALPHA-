/* Barre d'accessibilité SAFINUM, isolée de la page cible par un Shadow DOM. */
(function () {
  "use strict";

  const NS = (globalThis.SAFINUM = globalThis.SAFINUM || {});
  const MODES = [
    { id: "fr", code: "FR", label: "Français" },
    { id: "en", code: "EN", label: "English" },
    { id: "local", code: "ET", label: "Eton (Ìtón)" },
  ];

  const ICONS = {
    language: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>',
    path: '<path d="M6 4v5a3 3 0 0 0 3 3h6a3 3 0 0 1 3 3v5"/><path d="m14 17 4 4 4-4"/><circle cx="6" cy="4" r="2"/>',
    shield: '<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/>',
    message: '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z"/>',
    speaker: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
    close: '<path d="m18 6-12 12M6 6l12 12"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
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
    .rail-group { width:100%; display:flex; flex-direction:column; align-items:center; gap:7px; }
    .rail-rule { width:32px; height:1px; margin:3px 0 4px; background:#42494a; }
    .rail-button { position:relative; width:46px; height:46px; padding:11px; display:grid;
      place-items:center; border:1px solid transparent; border-radius:13px; color:#aeb9bc;
      background:transparent; cursor:pointer; transition:color .16s,background .16s,border-color .16s,transform .16s; }
    .rail-button:hover { color:#f5fffc; background:#283232; transform:translateY(-1px); }
    .rail-button[aria-expanded="true"],.rail-button[data-active="true"] {
      color:var(--accent); background:var(--accent-soft); border-color:#31554e; }
    .rail-button svg { width:22px; height:22px; }
    .rail-button:focus-visible,.mode:focus-visible,.action:focus-visible,.close:focus-visible {
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
    .stats { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:6px; }
    .stat { padding:10px 4px; border:1px solid #394445; border-radius:11px;
      background:linear-gradient(145deg,#242d2e,#202627); text-align:center; }
    .stat strong { display:block; color:#f4f8f8; font-size:18px; line-height:1.1; }
    .stat span { display:block; margin-top:4px; color:var(--muted); font-size:9px; }
    .status { display:flex; align-items:flex-start; gap:8px; padding:10px 11px;
      border:1px solid #384344; border-radius:10px; color:#d7e0e2; background:#202728; font-size:10px; }
    .dot { width:8px;height:8px;flex:none;margin-top:4px;border-radius:50%;background:#879397; }
    .dot.ok { background:#55c695; }.dot.warn { background:var(--warning); }.dot.bad { background:#ee7474; }
    .status-copy { flex:1; }
    .security { display:flex; gap:8px; color:#bde4d7; font-size:10px; }
    .security svg { width:16px;height:16px;flex:none; }
    .unknown { width:100%; margin-top:10px; }
    .privacy { margin:8px 0 0; color:#9da9ac; font-size:9px; }
    @media(max-width:520px) { .rail { width:54px; padding-inline:5px; } .rail-button { width:42px;height:42px; }
      .drawer { right:62px; width:min(368px,calc(100vw - 74px)); } }
  `;

  function create({ hostId, onModeChange, onCopyUnknown, onSpeak }) {
    const host = document.createElement("div");
    host.id = hostId;
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>${CSS}</style>
      <nav class="rail" aria-label="Accessibilité SAFINUM">
        <div class="rail-group">
          <button class="rail-button" type="button" data-panel="language" aria-label="Langue et écoute" aria-expanded="false">${icon("language")}<span class="tooltip">Langue et écoute</span></button>
          <span class="rail-rule"></span>
          <button class="rail-button" type="button" data-panel="path" aria-label="Parcours financier">${icon("path")}<span class="tooltip">Parcours financier</span></button>
          <button class="rail-button" type="button" data-panel="security" aria-label="Protection des informations">${icon("shield")}<span class="tooltip">Protection des informations</span></button>
          <button class="rail-button" type="button" data-panel="voice" aria-label="Lecture vocale">${icon("speaker")}<span class="tooltip">Lecture vocale</span></button>
          <button class="rail-button" type="button" data-panel="unknown" aria-label="Textes à compléter">${icon("message")}<span class="tooltip">Textes à compléter</span></button>
        </div>
      </nav>
      <aside class="drawer" aria-label="Langue et accessibilité" hidden>
        <div class="inner">
          <header class="head">
            <span class="brand">${icon("language")}</span>
            <div class="title">SAFINUM<span class="subtitle">Accès financier en langue nationale</span></div>
            <button class="close" type="button" aria-label="Fermer le panneau">${icon("close")}</button>
          </header>
          <section class="section" data-section="language">
            <h2 class="section-heading">Langue d’affichage</h2>
            <p class="section-note">Le choix FR/EN du service financier reste indépendant.</p>
            <div class="modes" role="group" aria-label="Choisir la langue d’affichage"></div>
            <button class="reset" type="button">Revenir au texte d’origine</button>
          </section>
          <section class="section" data-section="voice">
            <h2 class="section-heading">Écouter les informations affichées</h2>
            <div class="voice-card">
              <span class="voice-mark">${icon("speaker")}</span>
              <span class="voice-copy"><span class="voice-title">Lecture vocale</span><span class="voice-hint">Lecture locale du contenu visible</span></span>
              <button class="action speak" type="button">Écouter</button>
            </div>
            <p class="voice-status" data-state="notice" aria-live="polite">Pour l’Eton, la synthèse est désactivée en attendant des enregistrements natifs validés.</p>
          </section>
          <section class="section" data-section="path">
            <h2 class="section-heading">Parcours pris en charge</h2>
            <p class="section-note">Solde · frais · préparation du transfert · récapitulatif · alertes.</p>
            <div class="stats" aria-label="État des textes">
              <div class="stat"><strong class="translated-count">0</strong><span>traduits</span></div>
              <div class="stat"><strong class="pending-count">0</strong><span>à valider</span></div>
              <div class="stat"><strong class="unknown-count">0</strong><span>inédits</span></div>
            </div>
          </section>
          <section class="section" data-section="security">
            <div class="security">${icon("check")}<span>Montants, frais, noms et références sont contrôlés avant affichage.</span></div>
            <p class="privacy">L’extension agit sur l’affichage de la page, sans modifier le service cible ni envoyer son contenu.</p>
          </section>
          <section class="section" data-section="unknown">
            <h2 class="section-heading">Contenu inédit</h2>
            <div class="status" aria-live="polite"><span class="dot"></span><span class="status-copy"></span></div>
            <button class="action unknown" type="button">Copier les textes inconnus</button>
          </section>
        </div>
      </aside>`;

    const drawer = root.querySelector(".drawer");
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
    closeButton.addEventListener("click", () => {
      close();
      root.querySelector('.rail-button[data-panel="language"]').focus();
    });
    root.querySelector(".reset").addEventListener("click", () => onModeChange("original"));
    root.querySelector(".speak").addEventListener("click", onSpeak);
    const unknownButton = root.querySelector(".unknown");
    unknownButton.addEventListener("click", onCopyUnknown);
    document.documentElement.appendChild(host);

    return {
      update(stats, currentMode, unknownCount) {
        modeButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.mode === currentMode)));
        root.querySelector(".translated-count").textContent = String(stats.ok);
        root.querySelector(".pending-count").textContent = String(stats.pending);
        root.querySelector(".unknown-count").textContent = String(stats.unknown);
        unknownButton.disabled = unknownCount === 0;
        unknownButton.textContent = unknownCount ? `Copier les textes inconnus (${unknownCount})` : "Aucun texte inconnu";

        const dot = root.querySelector(".dot");
        const status = root.querySelector(".status-copy");
        dot.className = "dot";
        if (currentMode === "original") {
          status.textContent = "Le texte source est affiché.";
        } else if (stats.failed > 0) {
          dot.classList.add("bad");
          status.textContent = "Contrôle échoué : le texte concerné reste dans sa langue source.";
        } else if (currentMode === "local" && stats.pending > 0) {
          dot.classList.add("warn");
          status.textContent = "Traductions Eton à valider par une personne compétente.";
        } else if (stats.unknown > 0) {
          dot.classList.add("warn");
          status.textContent = "Les textes inédits restent dans leur langue source.";
        } else {
          dot.classList.add("ok");
          status.textContent = "Traductions appliquées et valeurs contrôlées.";
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
      openAt,
      flash(message) {
        const previous = unknownButton.textContent;
        unknownButton.textContent = message;
        setTimeout(() => (unknownButton.textContent = previous), 1400);
      },
    };
  }

  NS.panel = { create };
})();
