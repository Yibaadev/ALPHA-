/* Script injecté dans la page du service financier.
   - lit les textes de la page et les remplace par la version validée du dictionnaire ;
   - vérifie que chaque valeur sensible (montant, numéro, nom...) est restée identique ;
   - surveille la page : quand l'écran change ou qu'un message apparaît (toast, alerte), il le traduit aussitôt ;
   - affiche un petit panneau de contrôle (langue + état du contrôle).
   Il ne modifie jamais le code du site : il agit seulement sur ce qui est affiché. */
(function () {
  "use strict";
  const NS = globalThis.SAFINUM;
  const T = NS.translate;
 
  const HOST_ID = "safinum-lang-panel";
  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA"]);
  const ATTRS = ["placeholder", "title", "aria-label"];
  const OBSERVE = {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ATTRS,
  };
 
  let dict = null;
  let mode = "original"; // "original" | "fr" | "en" | "local"
  let panel = null;
  let observer = null;
  let stats = emptyStats();
  let lastCost = 0; // durée du dernier scan, en ms
  // Textes inconnus vus depuis le début, même si le message a disparu depuis
  // (messages temporaires : toasts, alertes).
  const collectedUnknown = new Set();
 
  // Pour chaque texte, on retient l'original et ce que nous avons écrit.
  // Si le site change le texte lui-même, on le détecte et on repart du nouveau texte.
  const textState = new WeakMap();
  const attrState = new WeakMap();
 
  function emptyStats() {
    return { ok: 0, pending: 0, unknown: 0, failed: 0, values: 0 };
  }
 
  function record(res, original) {
    if (res.kind === "ok") stats.ok++;
    else if (res.kind === "pending") stats.pending++;
    else if (res.kind === "integrity") stats.failed++;
    else if (res.kind === "unknown") {
      stats.unknown++;
      collectedUnknown.add(original.trim().replace(/\s+/g, " "));
    }
  }
 
  // Décide quel texte afficher pour une valeur donnée (texte ou attribut).
  function decide(st, current) {
    if (st.written === undefined || current !== st.written) {
      st.orig = current; // texte d'origine (nouveau, ou modifié par le site)
      st.written = undefined;
    }
    const original = st.orig;
    const res = T.analyse(original, mode === "original" ? "local" : mode);
    record(res, original);
 
    if (mode !== "original" && res.kind === "ok") {
      const lead = original.match(/^\s*/)[0];
      const trail = original.match(/\s*$/)[0];
      const candidate = lead + res.text + trail;
      // Contrôle en direct : chaque valeur protégée doit apparaître telle quelle.
      if (res.values.every((v) => candidate.includes(v))) {
        stats.values += res.values.length;
        return candidate;
      }
      stats.failed++;
    }
    return original;
  }
 
  function writeText(node) {
    let st = textState.get(node);
    if (!st) textState.set(node, (st = {}));
    const desired = decide(st, node.nodeValue);
    if (node.nodeValue !== desired) node.nodeValue = desired;
    st.written = desired;
  }
 
  function writeAttrs(el) {
    let map = attrState.get(el);
    if (!map) attrState.set(el, (map = {}));
    for (const a of ATTRS) {
      if (!el.hasAttribute(a)) continue;
      const st = map[a] || (map[a] = {});
      const desired = decide(st, el.getAttribute(a));
      if (el.getAttribute(a) !== desired) el.setAttribute(a, desired);
      st.written = desired;
    }
  }
 
  function apply() {
    if (!dict || !document.body) return;
    const t0 = performance.now();
    if (observer) observer.disconnect(); // nos propres écritures ne doivent pas relancer le scan
    stats = emptyStats();
 
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        const p = n.parentElement;
        if (!p || SKIP_TAGS.has(p.tagName)) return NodeFilter.FILTER_REJECT;
        return n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(writeText);
    document.querySelectorAll("[placeholder],[title],[aria-label]").forEach(writeAttrs);
 
    lastCost = performance.now() - t0;
    if (panel) panel.update(stats, mode, collectedUnknown.size);
    if (observer) observer.observe(document.body, OBSERVE);
  }
 
  function setMode(next) {
    mode = next;
    try {
      chrome.storage.local.set({ safinumMode: next });
    } catch (e) {
      /* sans importance : on retient juste le choix pour cette page */
    }
    apply();
  }
 
  function copyUnknown() {
    const text = Array.from(collectedUnknown).join("\n");
    const done = () => panel && panel.flash("Copié");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
    } else {
      fallbackCopy(text, done);
    }
  }
 
  function fallbackCopy(text, done) {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    try {
      document.execCommand("copy");
      done();
    } catch (e) {
      /* rien de plus à faire */
    }
    area.remove();
  }
 
  /* ---------- Panneau de contrôle (dans un shadow DOM : le site ne peut pas le casser) ---------- */
 
  const CSS = `
    :host { all: initial; }
    .box { position: fixed; right: 16px; bottom: 16px; z-index: 2147483647; width: 288px;
      font: 13px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; color: #e6e9ee;
      background: #12171d; border: 1px solid #2a323d; border-radius: 10px; padding: 12px; }
    .head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
    .title { font-weight: 600; font-size: 13px; }
    .min { background: none; border: 0; color: #9aa4b2; font-size: 16px; cursor: pointer; padding: 0 4px; }
    .modes { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
    .modes button { flex: 1 1 auto; padding: 7px 10px; border-radius: 7px; border: 1px solid #2a323d;
      background: #181e26; color: #e6e9ee; font: inherit; cursor: pointer; }
    .modes button[aria-pressed="true"] { border-color: #00bfff; color: #00bfff; }
    .modes button:focus-visible, .min:focus-visible, .copy:focus-visible { outline: 2px solid #00bfff; outline-offset: 2px; }
    .state { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
    .dot { width: 9px; height: 9px; border-radius: 50%; background: #6b7685; flex: none; }
    .dot.ok { background: #2fbf71; }
    .dot.bad { background: #e5484d; }
    .line { color: #9aa4b2; font-size: 12px; }
    .copy { margin-top: 8px; width: 100%; padding: 6px 8px; border-radius: 7px; border: 1px solid #2a323d;
      background: transparent; color: #9aa4b2; font: inherit; font-size: 12px; cursor: pointer; }
    .copy[disabled] { opacity: .45; cursor: default; }
    .body[hidden] { display: none; }
  `;
 
  function buildPanel() {
    const host = document.createElement("div");
    host.id = HOST_ID;
    const root = host.attachShadow({ mode: "open" });
    const label = (dict.meta && dict.meta.localLanguage && dict.meta.localLanguage.label) || "Langue locale";
    const hasEn = dict.entries.some((e) => e.en && e.en.trim());
 
    const modes = [{ id: "original", label: "Original" }];
    if (hasEn) modes.push({ id: "fr", label: "Français" }, { id: "en", label: "English" });
    modes.push({ id: "local", label });
 
    root.innerHTML =
      "<style>" + CSS + "</style>" +
      '<section class="box" aria-label="Langue de l\'interface">' +
      '<div class="head"><span class="title">Langue de l\'interface</span>' +
      '<button class="min" type="button" aria-label="Réduire ou agrandir le panneau" aria-expanded="true">–</button></div>' +
      '<div class="body">' +
      '<div class="modes" role="group" aria-label="Choix de la langue"></div>' +
      '<div class="state" aria-live="polite"><span class="dot"></span><span class="status"></span></div>' +
      '<div class="line counts"></div>' +
      '<button class="copy" type="button">Copier les textes inconnus</button>' +
      "</div></section>";
 
    const modesBox = root.querySelector(".modes");
    modes.forEach((m) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = m.label;
      b.dataset.mode = m.id;
      b.addEventListener("click", () => setMode(m.id));
      modesBox.appendChild(b);
    });
 
    const body = root.querySelector(".body");
    const min = root.querySelector(".min");
    min.addEventListener("click", () => {
      body.hidden = !body.hidden;
      min.setAttribute("aria-expanded", String(!body.hidden));
    });
 
    const dot = root.querySelector(".dot");
    const status = root.querySelector(".status");
    const counts = root.querySelector(".counts");
    const copy = root.querySelector(".copy");
    copy.addEventListener("click", copyUnknown);
 
    document.documentElement.appendChild(host);
 
    return {
      update(s, current, unknownCount) {
        modesBox.querySelectorAll("button").forEach((b) => {
          b.setAttribute("aria-pressed", String(b.dataset.mode === current));
        });
        if (current === "original") {
          dot.className = "dot";
          status.textContent = "Page d'origine, aucune modification";
        } else if (s.failed > 0) {
          dot.className = "dot bad";
          status.textContent = s.failed + " texte(s) laissé(s) en original : contrôle échoué";
        } else {
          dot.className = "dot ok";
          status.textContent = "Valeurs vérifiées : " + s.values + " sur " + s.values + " identiques";
        }
        counts.textContent = "Traduits : " + s.ok + " · À traduire : " + s.pending + " · Inconnus : " + s.unknown;
        copy.disabled = unknownCount === 0;
        copy.textContent = "Copier les textes inconnus (" + unknownCount + ")";
      },
      flash(msg) {
        const old = copy.textContent;
        copy.textContent = msg;
        setTimeout(() => (copy.textContent = old), 1200);
      },
    };
  }
 
  /* ---------- Démarrage ---------- */
 
  async function readSavedMode() {
    try {
      const r = await chrome.storage.local.get("safinumMode");
      return r && r.safinumMode;
    } catch (e) {
      return undefined;
    }
  }
 
  async function init() {
    if (document.getElementById(HOST_ID)) return; // déjà lancé
    const res = await fetch(chrome.runtime.getURL("data/dictionary.json"));
    dict = await res.json();
    T.init(dict);
 
    const saved = await readSavedMode();
    if (["original", "fr", "en", "local"].includes(saved)) mode = saved;
 
    panel = buildPanel();
    // Appelé dès que la page change, avant l'affichage : un message qui apparaît
    // (écran suivant, toast, alerte) est traduit sans clignotement du français.
    // Sur une page lourde (scan lent), on regroupe les changements pour ne pas ralentir le site.
    let waiting = false;
    observer = new MutationObserver(() => {
      if (lastCost < 12) return apply();
      if (waiting) return;
      waiting = true;
      setTimeout(() => {
        waiting = false;
        apply();
      }, 150);
    });
    apply();
  }
 
  init().catch((e) => console.error("[SAFINUM] démarrage impossible :", e));
})();
 