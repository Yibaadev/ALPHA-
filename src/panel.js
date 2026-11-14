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
  /* Carte du Cameroun en relief (drapeau vert-rouge-jaune + étoile), sans fond. */
  const CM_PATH = "M56 1L60 4L64 10L61 16L66 22L65 26L71 31L59 33L54 36L59 42L66 48L70 57L65 64L61 70L60 78L61 87L66 92L68 98L75 106L77 112L75 115L68 112L59 111L48 110L35 110L28 110L13 109L13 102L11 96L5 93L3 89L1 85L3 78L9 72L15 64L21 63L25 67L31 62L34 58L35 52L39 46L43 43L45 36L47 31L50 26L53 22L56 16L57 8L55 2Z";
  const cameroonMap = (id = "cm") => `<svg class="cm-map" viewBox="-1 -1 84 122" aria-hidden="true">
    <defs>
      <clipPath id="${id}-clip"><path d="${CM_PATH}"/></clipPath>
      <linearGradient id="${id}-light" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity=".28"/>
        <stop offset=".55" stop-color="#fff" stop-opacity="0"/>
        <stop offset="1" stop-color="#000" stop-opacity=".12"/>
      </linearGradient>
      <g id="${id}-side" clip-path="url(#${id}-clip)">
        <rect x="0" y="0" width="28" height="120" fill="#03513a"/>
        <rect x="28" y="0" width="24" height="120" fill="#8a0d18"/>
        <rect x="52" y="0" width="30" height="120" fill="#b88a00"/>
      </g>
    </defs>
    <use href="#${id}-side" transform="translate(4.2 5.2)"/>
    <use href="#${id}-side" transform="translate(3.4 4.2)"/>
    <use href="#${id}-side" transform="translate(2.6 3.2)"/>
    <use href="#${id}-side" transform="translate(1.8 2.2)"/>
    <use href="#${id}-side" transform="translate(1 1.2)"/>
    <g clip-path="url(#${id}-clip)">
      <rect x="0" y="0" width="28" height="120" fill="#007a5e"/>
      <rect x="28" y="0" width="24" height="120" fill="#ce1126"/>
      <rect x="52" y="0" width="30" height="120" fill="#fcd116"/>
      <path fill="#fcd116" d="M42 53.5L43.5 57.9L48.2 58L44.5 60.8L45.8 65.3L42 62.6L38.2 65.3L39.5 60.8L35.8 58L40.5 57.9Z"/>
      <rect x="0" y="0" width="82" height="120" fill="url(#${id}-light)"/>
    </g>
  </svg>`;
  const alphaMark = () => '<svg class="alpha-mark" viewBox="130 65 235 235" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M145 280 218 80h31l52 141c14-18 22-38 27-58h22c-5 30-17 55-34 75l25 41h-34l-15-18c-15 13-32 20-51 20-24 0-42-10-50-28l-10 27h-36zm63-79h52l-28-69z"/></svg>';


  function create({ hostId, onModeChange, onSpeak, onZoomChange }) {
    const host = document.createElement("div");
    host.id = hostId;
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `
      <link rel="stylesheet" href="${chrome.runtime.getURL("src/panel.css")}">
      <nav class="rail" aria-label="Accessibilité ALPHA" hidden>
        <div class="rail-brand" role="button" tabindex="0" aria-label="Ouvrir le panneau ALPHA" title="ALPHA">${cameroonMap("cm-rail")}</div>
        <span class="rail-rule"></span>
        <div class="rail-group">
          <button class="rail-button" type="button" data-panel="language" aria-label="Langues" aria-expanded="false">${icon("language")}<span class="tooltip">Langues</span></button>
          <button class="rail-button" type="button" data-panel="zoom" aria-label="Agrandir l’affichage">${icon("zoom")}<span class="tooltip">Agrandir</span></button>
          <button class="rail-button" type="button" data-panel="voice" aria-label="Lecture vocale">${icon("speaker")}<span class="tooltip">Lecture vocale</span></button>
        </div>
        <span class="rail-rule"></span>
        <button class="rail-button rail-dismiss" type="button" aria-label="Masquer la barre ALPHA">${icon("close")}<span class="tooltip">Masquer la barre</span></button>
      </nav>
      <button class="launcher" type="button" aria-label="Ouvrir la barre ALPHA" title="Ouvrir ALPHA — glisser pour déplacer"><span class="cm-enter"><span class="cm-float">${cameroonMap("cm-launch")}</span></span><span class="cm-shadow"></span></button>
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
            <p class="section-note mt-notice" aria-live="polite" hidden></p>
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

    /* section = "all" (mini carte : panneau complet) ou une section précise (globe, loupe, haut-parleur). */
    let openSection = null;
    function openAt(section) {
      drawer.hidden = false;
      openSection = section;
      drawer.querySelectorAll("[data-section]").forEach((node) => {
        node.style.display = section === "all" || node.dataset.section === section ? "" : "none";
      });
      railButtons.forEach((button) => {
        const active = button.dataset.panel === section;
        button.setAttribute("aria-expanded", String(active));
        button.dataset.active = String(active);
      });
      placePanels();
      if (section === "all" || section === "language") root.querySelector(".close").focus();
      else drawer.querySelector(`[data-section="${section}"]`)?.scrollIntoView({ block: "nearest" });
    }
    function close() {
      drawer.hidden = true;
      openSection = null;
      railButtons.forEach((button) => {
        button.setAttribute("aria-expanded", "false");
        button.dataset.active = "false";
      });
    }

    /* Mini carte : ouvre le panneau complet, ou le referme s'il est déjà ouvert ainsi. */
    function toggleAll() {
      if (!drawer.hidden && openSection === "all") close();
      else openAt("all");
    }
    railBrand.addEventListener("click", toggleAll);
    railBrand.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleAll();
      }
    });

    railButtons.forEach((button) => button.addEventListener("click", () => openAt(button.dataset.panel)));
    root.querySelector(".rail-dismiss").addEventListener("click", () => {
      drawer.hidden = true;
      rail.hidden = true;
      launcher.hidden = false;
      launcher.focus();
    });
    /* Lanceur déplaçable : glisser-déposer (souris/tactile) ou flèches du clavier.
       La position est mémorisée pour toutes les pages via chrome.storage. */
    const POS_KEY = "alphaLauncherPos";
    const store = globalThis.chrome?.storage?.local;
    let launcherPos = null;
    let suppressClick = false;

    function placeLauncher(pos, save) {
      if (!pos) return;
      const w = launcher.offsetWidth || 52;
      const h = launcher.offsetHeight || 74;
      const x = Math.min(Math.max(0, pos.x), Math.max(0, window.innerWidth - w));
      const y = Math.min(Math.max(0, pos.y), Math.max(0, window.innerHeight - h));
      launcherPos = { x, y };
      launcher.classList.add("placed");
      launcher.style.left = x + "px";
      launcher.style.top = y + "px";
      if (save) {
        try { store?.set({ [POS_KEY]: launcherPos }); } catch (_) { /* contexte d'extension invalidé */ }
      }
    }
    try {
      store?.get(POS_KEY, (res) => { if (res && res[POS_KEY]) placeLauncher(res[POS_KEY], false); });
    } catch (_) { /* stockage indisponible : position par défaut */ }
    /* La barre et le panneau s'ouvrent là où l'utilisateur a placé la carte
       (le panneau se met du côté où il y a le plus de place). */
    function placePanels() {
      if (!launcherPos) return;
      const M = 10;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (!rail.hidden) {
        const rw = rail.offsetWidth;
        const rh = rail.offsetHeight;
        const cx = launcherPos.x + (launcher.offsetWidth || 52) / 2;
        const rx = Math.min(Math.max(M, cx - rw / 2), vw - rw - M);
        const ry = Math.min(Math.max(M, launcherPos.y), Math.max(M, vh - rh - M));
        rail.style.left = rx + "px";
        rail.style.top = ry + "px";
        rail.style.right = "auto";
      }
      if (!drawer.hidden) {
        const r = rail.getBoundingClientRect();
        const dw = drawer.offsetWidth;
        const dh = drawer.offsetHeight;
        const gap = 8;
        const toLeft = r.left + r.width / 2 > vw / 2;
        let dx = toLeft ? r.left - gap - dw : r.right + gap;
        dx = Math.min(Math.max(M, dx), Math.max(M, vw - dw - M));
        const dy = Math.min(Math.max(M, r.top), Math.max(M, vh - dh - M));
        drawer.style.left = dx + "px";
        drawer.style.top = dy + "px";
        drawer.style.right = "auto";
      }
    }
    window.addEventListener("resize", () => {
      if (launcherPos) placeLauncher(launcherPos, false);
      placePanels();
    });

    launcher.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      const rect = launcher.getBoundingClientRect();
      const dx = e.clientX - rect.left;
      const dy = e.clientY - rect.top;
      const startX = e.clientX;
      const startY = e.clientY;
      let dragging = false;
      launcher.setPointerCapture(e.pointerId);
      const move = (ev) => {
        if (!dragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 5) return;
        dragging = true;
        launcher.classList.add("dragging");
        placeLauncher({ x: ev.clientX - dx, y: ev.clientY - dy }, false);
      };
      const up = () => {
        launcher.removeEventListener("pointermove", move);
        launcher.removeEventListener("pointerup", up);
        launcher.removeEventListener("pointercancel", up);
        launcher.classList.remove("dragging");
        if (dragging) {
          suppressClick = true;
          setTimeout(() => { suppressClick = false; }, 0);
          placeLauncher(launcherPos, true);
        }
      };
      launcher.addEventListener("pointermove", move);
      launcher.addEventListener("pointerup", up);
      launcher.addEventListener("pointercancel", up);
    });
    launcher.addEventListener("keydown", (e) => {
      const step = e.shiftKey ? 40 : 10;
      const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (!d) return;
      e.preventDefault();
      const rect = launcher.getBoundingClientRect();
      placeLauncher({ x: rect.left + d[0], y: rect.top + d[1] }, true);
    });

    launcher.addEventListener("click", () => {
      if (suppressClick) { suppressClick = false; return; }
      launcher.hidden = true;
      rail.hidden = false;
      placePanels();
      rail.classList.remove("rail-in");
      void rail.offsetWidth;
      rail.classList.add("rail-in");
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
      // État de la traduction hors ligne des contenus nouveaux (vide = rien à signaler).
      setNotice(message) {
        const notice = root.querySelector(".mt-notice");
        notice.textContent = message || "";
        notice.hidden = !message;
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
