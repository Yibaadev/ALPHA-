/* Script injecté dans la page du service financier.
   - adapte les textes de la page selon la langue choisie ;
   - préserve les valeurs sensibles (montants, numéros, dates...) sans altération ;
   - surveille la page pour adapter les nouveaux contenus à la volée ;
   - propose le choix de langue, la lecture vocale et le zoom d'accessibilité.
   Il ne modifie jamais le code source du site : il agit uniquement sur l'affichage. */
(function () {
  "use strict";
  const NS = globalThis.ALPHA;
  const T = NS.translate;

  const HOST_ID = "alpha-lang-panel";
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
  let stats = { ok: 0, total: 0 };
  let lastCost = 0; // durée du dernier scan, en ms

  // Pour chaque texte, on retient l'original et ce qui a été affiché.
  const textState = new WeakMap();
  const attrState = new WeakMap();

  function retainOuterWhitespace(original, translated) {
    if (translated === original) return original;
    const lead = original.match(/^\s*/)?.[0] || "";
    const trail = original.match(/\s*$/)?.[0] || "";
    return lead + translated + trail;
  }

  function unwrapText(node, state) {
    const wrapper = state.wrapper;
    if (wrapper && wrapper.parentNode && wrapper.contains(node)) {
      wrapper.parentNode.insertBefore(node, wrapper);
      wrapper.remove();
    }
    state.wrapper = null;
    state.statusText = null;
    state.badge = null;
    state.originalLabel = null;
    state.warning = null;
  }

  // Décide quel texte afficher pour une valeur donnée (texte ou attribut).
  function decide(st, current) {
    if (st.written === undefined || current !== st.written) {
      st.orig = current; // texte d'origine (nouveau, ou modifié par le site)
      st.written = undefined;
    }
    const original = st.orig;

    if (mode === "original") {
      return original;
    }

    if (mode === "local") {
      if (T.analyse(original, "local", pageLanguage).kind === "skip") return original;
      const structured = criticalData
        ? T.translate(original, { target: "eton", pageLanguage })
        : null;

      if (structured && typeof structured.eton === "string" && structured.eton.trim() && structured.marqueurs_ok !== false) {
        stats.ok++;
        return retainOuterWhitespace(original, structured.eton);
      }
      return original;
    }

    const res = T.analyse(original, mode, pageLanguage);
    if (res.kind === "ok") {
      const candidate = retainOuterWhitespace(original, res.text);
      if (res.values.every((v) => candidate.includes(v))) {
        stats.ok++;
        return candidate;
      }
    }
    return original;
  }

  function writeText(node) {
    let st = textState.get(node);
    if (!st) textState.set(node, (st = {}));
    stats.total++;
    const desired = decide(st, node.nodeValue);
    if (node.nodeValue !== desired) node.nodeValue = desired;
    st.written = desired;
    unwrapText(node, st);
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
    stats = { ok: 0, total: 0 };

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        const p = n.parentElement;
        if (!p || SKIP_TAGS.has(p.tagName)) return NodeFilter.FILTER_REJECT;
        if (p.namespaceURI === "http://www.w3.org/2000/svg") return NodeFilter.FILTER_REJECT;
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
      chrome.storage.local.set({ alphaMode: next });
    } catch (e) {
      /* sans importance : on retient juste le choix pour cette page */
    }
    apply();
  }

  // Agrandit le contenu du site tout en gardant le rail ALPHA à sa taille normale.
  function setZoom(percent) {
    const body = document.body;
    if (!body) return;
    if (percent === 100) {
      body.style.zoom = originalBodyZoom;
      return;
    }
    body.style.zoom = String(baseBodyZoom * (percent / 100));
  }

  // Réserve la synthèse du navigateur au français et à l'anglais avec une voix locale.
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

    const visibleText = (document.body.innerText || "").replace(/\s+/g, " ").trim().slice(0, 4000);
    if (!visibleText) {
      panel.setVoiceStatus("Aucun texte visible à lire.");
      return;
    }

    const utterance = new SpeechSynthesisUtterance(visibleText);
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
    panel.setVoiceStatus("Lecture vocale en cours…");
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  /* ---------- Démarrage ---------- */

  async function readSavedMode() {
    try {
      const r = await chrome.storage.local.get("alphaMode");
      return r && r.alphaMode;
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

  init().catch((e) => console.error("[ALPHA] démarrage impossible :", e));
})();
