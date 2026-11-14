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

  const CSS = `
    :host {
      all: initial;
      color-scheme: light;
      --ink: #14221d;
      --muted: #53645e;
      --line: #d8e2dd;
      --canvas: #f8faf8;
      --surface: #ffffff;
      --accent: #007a5e;
      --accent-strong: #005c47;
      --accent-soft: #e6f3ee;
      --accent-border: #94c9b6;
      --cm-green: #007a5e;
      --cm-red: #ce1126;
      --cm-yellow: #fcd116;
      --cm-stripe: linear-gradient(90deg, var(--cm-green) 0 33.34%, var(--cm-red) 33.34% 66.67%, var(--cm-yellow) 66.67%);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }
    *, *::before, *::after { box-sizing: border-box; }
    button { color: inherit; font: inherit; touch-action: manipulation; }
    button:focus-visible, [role="button"]:focus-visible {
      outline: 2px solid var(--cm-yellow);
      outline-offset: 2px;
    }
    .drawer button:focus-visible {
      outline-color: var(--accent);
      outline-offset: 2px;
    }
    /* Barre latérale flottante (Floating Dock) */
    .rail {
      position: fixed; top: 14px; right: 12px; z-index: 2147483647; width: 50px;
      display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 7px 4px;
      color: #eef5f1;
      background: var(--cm-stripe) top / 100% 3px no-repeat, rgba(10, 30, 23, 0.95);
      padding-top: 10px;
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
      border-radius: 8px; background: transparent;
      cursor: pointer; transition: background-color .15s ease, transform .15s ease;
    }
    .rail-brand:hover { background: rgba(252, 209, 22, 0.1); transform: scale(1.08); }
    .rail-brand svg { width: auto; height: 28px; filter: drop-shadow(0 1px 1px rgba(0, 0, 0, .4)); }
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
      background: linear-gradient(135deg, #00906f, #005c47);
      border-color: rgba(255, 255, 255, 0.28);
      box-shadow: 0 2px 10px rgba(0, 122, 94, 0.5);
    }
    .rail-button[aria-expanded="true"]::before, .rail-button[data-active="true"]::before {
      content: ""; position: absolute; left: -4px; top: 50%; transform: translateY(-50%);
      width: 3px; height: 16px; border-radius: 2px; background: var(--cm-yellow);
    }
    .rail-button svg { width: 19px; height: 19px; }
    @keyframes cm-bob {
      0%, 100% { transform: translateY(2px); }
      50% { transform: translateY(-5px); }
    }
    @keyframes cm-shadow {
      0%, 100% { transform: scaleX(1); opacity: .55; }
      50% { transform: scaleX(.7); opacity: .3; }
    }
    .rail-dismiss { color: #8fa69c; }
    .rail-dismiss:hover {
      color: #ff9b9b; background: rgba(239, 68, 68, 0.16); border-color: rgba(239, 68, 68, 0.3);
    }
    /* Lanceur : carte du Cameroun en 3D, sans fond, qui flotte légèrement. */
    .launcher {
      position: fixed; top: 50%; right: 12px; z-index: 2147483647; width: 52px; height: 74px; padding: 0;
      display: grid; place-items: center; border: 0; border-radius: 10px;
      background: none; box-shadow: none; cursor: pointer;
      transform: translateY(-50%); transition: transform .18s ease;
    }
    .launcher:hover { transform: translateY(-50%) scale(1.08); }
    .launcher[hidden] { display: none; }
    .launcher { touch-action: none; user-select: none; -webkit-user-select: none; }
    .launcher.placed { right: auto; transform: none; }
    .launcher.placed:hover { transform: scale(1.08); }
    .launcher.dragging { cursor: grabbing; transition: none; transform: scale(1.12); }
    .launcher.dragging .cm-float { animation-play-state: paused; }
    /* Entrée de la carte au chargement : glisse depuis la droite, rebondit, puis flotte. */
    .launcher .cm-enter { display: block; animation: cm-enter .9s cubic-bezier(.22, 1.3, .36, 1) both; }
    @keyframes cm-enter {
      0% { opacity: 0; transform: translateX(60px) rotate(18deg) scale(.4); }
      60% { opacity: 1; }
      100% { opacity: 1; transform: none; }
    }
    /* Ouverture de la barre : apparition douce. */
    .rail.rail-in { animation: rail-in .28s ease-out both; }
    @keyframes rail-in {
      from { opacity: 0; transform: translateX(16px) scale(.96); }
      to { opacity: 1; transform: none; }
    }
    .launcher .cm-float {
      display: block; line-height: 0;
      animation: cm-bob 2.8s ease-in-out infinite;
      filter: drop-shadow(0 2px 3px rgba(0, 0, 0, .35));
      transition: filter .2s ease;
    }
    .launcher .cm-map { display: block; width: auto; height: 62px; }
    .launcher .cm-shadow {
      position: absolute; left: 50%; bottom: 0; width: 34px; height: 6px; margin-left: -17px;
      border-radius: 50%; background: rgba(0, 0, 0, .4); filter: blur(2px);
      animation: cm-shadow 2.8s ease-in-out infinite;
    }
    .launcher:hover .cm-float, .launcher:focus-visible .cm-float {
      filter: drop-shadow(0 0 6px rgba(252, 209, 22, .5)) drop-shadow(0 2px 3px rgba(0, 0, 0, .35));
    }
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
      color: var(--ink); background: var(--cm-stripe) top / 100% 3px no-repeat, var(--canvas); border: 1px solid #cbd7d1; border-radius: 12px;
      box-shadow: 0 12px 34px -4px rgba(15, 38, 32, .18), 0 4px 12px -2px rgba(15, 38, 32, .08);
      font: 12.5px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      scrollbar-color: #a4b4ad transparent; scrollbar-width: thin;
    }
    .drawer[hidden] { display: none; }
    .inner { padding: 14px 14px 16px; }
    .head { display: flex; align-items: center; gap: 9px; margin-bottom: 12px; }
    .brand {
      width: 32px; height: 32px; display: grid; place-items: center; flex: none;
      color: var(--accent); background: var(--accent-soft); border: 1px solid var(--accent-border); border-radius: 7px;
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
      color: #00402f; border-color: var(--accent); background: var(--accent-soft);
      box-shadow: inset 0 0 0 1px var(--accent);
    }
    .mode-code { font-size: 12.5px; font-weight: 750; line-height: 1.1; }
    .mode-name { color: var(--muted); font-size: 9.5px; line-height: 1.1; }
    .mode[aria-pressed="true"] .mode-name { color: var(--accent); font-weight: 600; }
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
    /* ---------- Adaptation à toutes les tailles d'écran ---------- */
    /* Hauteur réelle visible sur mobile (barre d'adresse comprise) et zones sûres (encoches). */
    .drawer { max-height: calc(100dvh - 28px); }
    .rail { top: max(14px, env(safe-area-inset-top)); right: max(12px, env(safe-area-inset-right)); }
    .rail::-webkit-scrollbar { display: none; }
    .launcher { right: max(12px, env(safe-area-inset-right)); }

    /* Téléphones : le panneau devient une feuille qui monte du bas de l'écran, pleine largeur. */
    @media (max-width: 560px) {
      .rail { right: max(8px, env(safe-area-inset-right)); top: max(10px, env(safe-area-inset-top)); width: 46px; padding: 9px 3px 6px; }
      .rail-button { width: 38px; height: 38px; }
      .rail-brand { width: 32px; height: 32px; }
      .drawer {
        left: max(8px, env(safe-area-inset-left)); right: max(8px, env(safe-area-inset-right));
        top: auto; bottom: max(8px, env(safe-area-inset-bottom));
        width: auto; max-width: none; max-height: min(72dvh, calc(100dvh - 24px));
        border-radius: 16px; font-size: 13.5px;
        box-shadow: 0 -8px 30px rgba(15, 38, 32, .22), 0 2px 8px rgba(15, 38, 32, .1);
        animation: sheet-in .24s ease-out both;
      }
      .inner { padding: 14px 16px 18px; }
      .title { font-size: 15px; }
      .subtitle, .section-note, .voice-hint, .zoom-hint, .voice-status { font-size: 12px; }
      .section-heading, .voice-title { font-size: 13.5px; }
      .mode-code { font-size: 14px; }
      .mode-name { font-size: 11px; }
      .reset, .zoom-reset, .action { font-size: 12.5px; }
    }
    @keyframes sheet-in {
      from { opacity: 0; transform: translateY(24px); }
      to { opacity: 1; transform: none; }
    }

    /* Écrans bas (téléphone en paysage) : barre plus compacte, panneau défilant. */
    @media (max-height: 420px) {
      .rail {
        gap: 2px; padding-top: 7px; padding-bottom: 5px;
        max-height: calc(100dvh - 20px); overflow-y: auto; overflow-x: hidden; scrollbar-width: none;
      }
      .rail-rule { margin: 1px 0; }
      .launcher { height: 60px; }
      .launcher .cm-map { height: 50px; }
    }

    /* Écrans tactiles : cibles d'au moins 44 px (recommandation WCAG), pas d'infobulles au survol. */
    @media (pointer: coarse) {
      .rail { width: 54px; }
      .rail-button { width: 44px; height: 44px; }
      .rail-brand { width: 40px; height: 40px; }
      .tooltip { display: none; }
      .close { width: 40px; height: 40px; }
      .mode { height: 50px; min-height: 50px; }
      .zoom-control { width: 44px; height: 44px; font-size: 20px; }
      .action { min-height: 44px; padding: 8px 16px; }
      .reset, .zoom-reset { min-height: 40px; padding: 8px 10px; }
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
    // Sur téléphone, le panneau est une feuille en bas de l'écran (voir le CSS) : pas de placement.
    const sheetQuery = typeof window.matchMedia === "function"
      ? window.matchMedia("(max-width: 560px)")
      : { get matches() { return window.innerWidth <= 560; } };
    function placePanels() {
      if (sheetQuery.matches) {
        drawer.style.left = drawer.style.top = drawer.style.right = "";
      }
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
      if (!drawer.hidden && !sheetQuery.matches) {
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
