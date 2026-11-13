/* Script injecté dans la page du service financier.
   - lit les textes de la page et les remplace par la version validée du dictionnaire ;
   - vérifie que chaque valeur sensible (montant, numéro, nom...) est restée identique ;
   - surveille la page : quand l'écran change ou qu'un message apparaît (toast, alerte), il le traduit aussitôt ;
   - propose le français et l'anglais, détecte la langue de la page et ajoute des commandes d'accessibilité.
   Il ne modifie jamais le code du site : il agit seulement sur ce qui est affiché. */
(function () {
  "use strict";
  const NS = globalThis.SAFINUM;
  const T = NS.translate;
  const Confidence = NS.confidence;

  const HOST_ID = "safinum-lang-panel";
  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "OPTION", "TITLE"]);
  const ATTRS = ["placeholder", "title", "aria-label"];
  const OBSERVE = {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ATTRS,
  };

  let dict = null;
  let criticalData = null;
  let mode = "original"; // "original" | "fr" | "en" | "local"
  let pageLanguage = null;
  let panel = null;
  let observer = null;
  let languageObserver = null;
  let speaking = false;
  let originalBodyZoom = "";
  let baseBodyZoom = 1;
  let stats = emptyStats();
  let lastCost = 0; // durée du dernier scan, en ms

  // Pour chaque texte, on retient l'original et ce que nous avons écrit.
  // Si le site change le texte lui-même, on le détecte et on repart du nouveau texte.
  const textState = new WeakMap();
  const attrState = new WeakMap();

  function emptyStats() {
    return {
      ok: 0, pending: 0, unknown: 0, failed: 0, values: 0,
      confidence: { valide: 0, probable: 0, automatique: 0, non_traduit: 0 },
    };
  }

  function record(res) {
    if (res.kind === "ok") stats.ok++;
    else if (res.kind === "pending") stats.pending++;
    else if (res.kind === "integrity") stats.failed++;
    else if (res.kind === "unknown") stats.unknown++;
  }

  function recordStructured(res) {
    if (res && Object.hasOwn(stats.confidence, res.statut)) {
      stats.confidence[res.statut]++;
      if (res.statut === "valide") stats.ok++;
      else if (res.statut === "probable" || res.statut === "automatique") stats.pending++;
      else stats.unknown++;
    }
    if (res && res.marqueurs_ok === false) stats.failed++;
  }

  function retainOuterWhitespace(original, translated) {
    if (translated === original) return original;
    return original.match(/^\s*/)[0] + translated + original.match(/\s*$/)[0];
  }

  function isSecurityWarning(original) {
    const terms = criticalData && criticalData.categories && criticalData.categories.securite;
    return Boolean(terms && Confidence.containsAnyTerm(original, terms));
  }

  function unwrapText(node, state) {
    const wrapper = state.wrapper;
    if (wrapper && wrapper.parentNode && wrapper.contains(node)) {
      wrapper.parentNode.insertBefore(node, wrapper);
      wrapper.remove();
    }
    state.wrapper = null;
    state.statusText = null;
  }

  function decorateText(node, state, presentation, original) {
    if (!state.wrapper || !state.wrapper.contains(node)) {
      const wrapper = document.createElement("span");
      wrapper.className = "safinum-status-wrap";
      wrapper.dataset.safinumUi = "confidence";
      const statusText = document.createElement("span");
      statusText.className = "safinum-status-text";
      const parent = node.parentNode;
      if (!parent) return;
      parent.insertBefore(wrapper, node);
      wrapper.appendChild(statusText);
      statusText.appendChild(node);
      // Aucun badge, libellé d'origine ni avertissement n'est injecté dans la page :
      // seul le texte traduit est affiché. Le statut reste porté par les attributs data-*.
      Object.assign(state, { wrapper, statusText });
    }
    state.wrapper.dataset.safinumStatus = presentation.status;
    state.wrapper.dataset.safinumOriginal = original;
    state.wrapper.dataset.safinumTranslation = presentation.translation || "";
    state.wrapper.dataset.safinumKeepOriginal = String(presentation.originalText !== null);
  }

  // Décide quel texte afficher pour une valeur donnée (texte ou attribut).
  function decide(st, current, canShowBadge) {
    if (st.written === undefined || current !== st.written) {
      st.orig = current; // texte d'origine (nouveau, ou modifié par le site)
      st.written = undefined;
    }
    const original = st.orig;
    st.presentation = null;
    if (mode === "local") {
      if (!canShowBadge) return original;
      if (T.analyse(original, "local", pageLanguage).kind === "skip") return original;
      const structured = criticalData
        ? T.translate(original, { target: "eton", pageLanguage })
        : {
            original, eton: null, statut: "non_traduit", source: "aucune", score: 0,
            marqueurs_ok: true, raisons: ["Liste des termes de sécurité indisponible."],
          };
      recordStructured(structured);
      st.presentation = Confidence.present(structured, original, isSecurityWarning(original));
      return retainOuterWhitespace(original, st.presentation.visibleText);
    }
    const res = mode === "original"
      ? { kind: "skip" }
      : T.analyse(original, mode, pageLanguage);
    record(res);

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
    const desired = decide(st, node.nodeValue, true);
    if (node.nodeValue !== desired) node.nodeValue = desired;
    st.written = desired;
    if (mode === "local" && st.presentation) decorateText(node, st, st.presentation, st.orig);
    else unwrapText(node, st);
  }

  function writeAttrs(el) {
    let map = attrState.get(el);
    if (!map) attrState.set(el, (map = {}));
    for (const a of ATTRS) {
      if (!el.hasAttribute(a)) continue;
      const st = map[a] || (map[a] = {});
      const desired = decide(st, el.getAttribute(a), false);
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
        if (p.namespaceURI === "http://www.w3.org/2000/svg") return NodeFilter.FILTER_REJECT;
        if (p.closest("[data-safinum-ui='confidence']") && !p.classList.contains("safinum-status-text")) {
          return NodeFilter.FILTER_REJECT;
        }
        return n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    const sourceSamples = nodes.map((node) => {
      const state = textState.get(node);
      return state && state.orig !== undefined ? state.orig : node.nodeValue;
    });
    pageLanguage = T.detectPageLanguage(document.documentElement.getAttribute("lang"), sourceSamples);
    nodes.forEach(writeText);
    document.querySelectorAll("[placeholder],[title],[aria-label]").forEach(writeAttrs);

    lastCost = performance.now() - t0;
    if (panel) panel.update(stats, mode, pageLanguage);
    if (observer) observer.observe(document.body, OBSERVE);
  }

  function setMode(next) {
    if (!["original", "fr", "en", "local"].includes(next)) return;
    mode = next;
    if (speaking && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      speaking = false;
      if (panel) panel.setSpeaking(false);
    }
    try {
      chrome.storage.local.set({ safinumMode: next });
    } catch (e) {
      /* sans importance : on retient juste le choix pour cette page */
    }
    apply();
  }

  // Agrandit le contenu du site tout en gardant le rail SAFINUM à sa taille normale.
  function setZoom(percent) {
    const body = document.body;
    if (!body) return;
    if (percent === 100) {
      body.style.zoom = originalBodyZoom;
      return;
    }
    body.style.zoom = String(baseBodyZoom * (percent / 100));
  }

  // Réserve la synthèse du navigateur au français et à l'anglais avec une voix marquée locale.
  function speakVisibleText() {
    if (!panel) return;
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      panel.setVoiceStatus("La lecture vocale n’est pas disponible dans ce navigateur.");
      return;
    }
    if (speaking) {
      window.speechSynthesis.cancel();
      speaking = false;
      panel.setSpeaking(false);
      panel.setVoiceStatus("Lecture arrêtée.");
      return;
    }

    let visibleText = document.body.innerText || "";
    if (mode === "local") {
      const copy = document.body.cloneNode(true);
      copy.querySelectorAll(".safinum-status-wrap").forEach((wrapper) => {
        const display = Confidence.present({
          statut: wrapper.dataset.safinumStatus,
          eton: wrapper.dataset.safinumTranslation || null,
          marqueurs_ok: true,
        }, wrapper.dataset.safinumOriginal || "", wrapper.dataset.safinumKeepOriginal === "true");
        wrapper.replaceWith(document.createTextNode(Confidence.speechText(display)));
      });
      visibleText = copy.innerText || "";
    }
    const text = visibleText.replace(/\s+/g, " ").trim().slice(0, 4000);
    if (!text) {
      panel.setVoiceStatus("Aucun texte visible à lire.");
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    const language = mode === "en" || (mode === "original" && pageLanguage === "en")
      ? "en-US"
      : "fr-FR";
    utterance.lang = language;
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find((candidate) =>
      candidate.localService && candidate.lang.toLowerCase().startsWith(language.slice(0, 2))
    );
    if (!voice) {
      panel.setVoiceStatus("Aucune voix locale correspondante n’est installée pour cette langue.");
      return;
    }
    utterance.voice = voice;
    utterance.onstart = () => {
      speaking = true;
      panel.setSpeaking(true);
    };
    utterance.onend = () => {
      speaking = false;
      panel.setSpeaking(false);
      panel.setVoiceStatus("Lecture terminée.");
    };
    utterance.onerror = () => {
      speaking = false;
      panel.setSpeaking(false);
      panel.setVoiceStatus("La lecture a échoué. Vérifiez les voix disponibles dans le navigateur.");
    };
    panel.setVoiceStatus(mode === "local"
      ? "Lecture locale en cours; les niveaux de fiabilité sont annoncés."
      : "Lecture locale en cours…");
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  /* ---------- Panneau de contrôle (dans un shadow DOM : le site ne peut pas le casser) ---------- */

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
    const [dictionaryResponse, criticalResponse, templatesResponse, lexiconResponse, rulesResponse] = await Promise.all([
      fetch(chrome.runtime.getURL("data/dictionary.json")),
      fetch(chrome.runtime.getURL("data/critical_terms.json")),
      fetch(chrome.runtime.getURL("data/templates.json")),
      fetch(chrome.runtime.getURL("data/lexicon.json")),
      fetch(chrome.runtime.getURL("data/rules.json")),
    ]);
    if (!dictionaryResponse.ok) throw new Error("Dictionnaire local indisponible.");
    const [loadedDictionary, loadedCritical, loadedTemplates, loadedLexicon, loadedRules] = await Promise.all([
      dictionaryResponse.json(),
      criticalResponse.ok ? criticalResponse.json() : Promise.resolve(null),
      templatesResponse.ok ? templatesResponse.json() : Promise.resolve([]),
      lexiconResponse.ok ? lexiconResponse.json() : Promise.resolve([]),
      rulesResponse.ok ? rulesResponse.json() : Promise.resolve([]),
    ]);
    dict = loadedDictionary;
    criticalData = loadedCritical;
    T.init(dict, {
      criticalTerms: criticalData,
      templates: loadedTemplates,
      lexicon: loadedLexicon,
      rules: loadedRules,
    });

    const saved = await readSavedMode();
    const initialLanguage = T.detectPageLanguage(
      document.documentElement.getAttribute("lang"),
      (document.body.innerText || "").split(/[\r\n]+/).filter(Boolean)
    );
    pageLanguage = initialLanguage;
    mode = ["original", "fr", "en", "local"].includes(saved) ? saved : initialLanguage || "original";

    originalBodyZoom = document.body.style.zoom;
    const computedBodyZoom = Number.parseFloat(getComputedStyle(document.body).zoom);
    if (Number.isFinite(computedBodyZoom)) baseBodyZoom = computedBodyZoom;

    panel = NS.panel.create({
      hostId: HOST_ID,
      onModeChange: setMode,
      onSpeak: speakVisibleText,
      onZoomChange: setZoom,
    });
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
    languageObserver = new MutationObserver(() => apply());
    languageObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["lang"],
    });
  }

  init().catch((e) => console.error("[SAFINUM] démarrage impossible :", e));
})();
