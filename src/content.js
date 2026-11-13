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
  // Contenus jamais traduits : code, styles, saisies de l'utilisateur.
  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "TITLE", "INPUT", "CODE", "PRE", "KBD", "SAMP", "TEMPLATE", "IFRAME", "CANVAS"]);
  const ATTRS = ["placeholder", "title", "aria-label", "alt"];
  const BUTTON_INPUTS = new Set(["button", "submit", "reset"]);
  const TYPED_INPUTS = new Set(["text", "search", "tel", "email", "url", "number", ""]);
  const IS_TOP = (() => {
    try {
      return window.top === window;
    } catch (e) {
      return false;
    }
  })();
  const OBSERVE = {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...ATTRS, "value"],
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

  // Valeurs saisies par l'utilisateur (nom, motif, note...). Quand la page les réaffiche
  // (récapitulatif, reçu), elles ne doivent jamais être traduites.
  // Gardées en mémoire seulement, jamais stockées ni transmises.
  const typedValues = new Map(); // texte saisi -> champ d'origine (référence faible)
  function rememberTyped(field) {
    const v = String(field.value || "").trim();
    if (v.length < 2) return;
    if (typedValues.size > 300) typedValues.delete(typedValues.keys().next().value);
    typedValues.set(v, typeof WeakRef === "function" ? new WeakRef(field) : null);
  }
  function collectTyped(root) {
    root.querySelectorAll("input, textarea").forEach((field) => {
      if (field.tagName === "TEXTAREA" || TYPED_INPUTS.has(field.type)) rememberTyped(field);
    });
  }
  // Une saisie réaffichée par la page est une donnée de l'utilisateur (nom, motif...),
  // SAUF si son champ est toujours là mais vidé : c'est alors une zone d'envoi de message
  // (messagerie, injection de contenu par le jury), et le message affiché doit être traduit.
  function isUserData(text) {
    const key = text.trim();
    if (!typedValues.has(key)) return false;
    const ref = typedValues.get(key);
    const field = ref && ref.deref();
    if (field && field.isConnected && !field.value.trim()) {
      typedValues.delete(key);
      return false;
    }
    return true;
  }

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
    if (isUserData(original)) return original; // donnée saisie par l'utilisateur

    if (mode === "local") {
      if (T.analyse(original, "local", pageLanguage).kind === "skip") return original;
      const eton = toEton(original, pageLanguage);
      if (eton) {
        stats.ok++;
        return retainOuterWhitespace(original, eton);
      }
      // Texte anglais inédit : passage par le français, puis vers l'éton si possible.
      // Sinon le français est affiché, plus proche du lecteur que l'anglais.
      if (sourceLanguageOf(original) === "en") {
        const french = machine(original, "en", "fr");
        if (french) {
          stats.ok++;
          return retainOuterWhitespace(original, toEton(french, "fr") || french);
        }
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
    // Contenu inédit (absent du dictionnaire) : traduction locale contrôlée.
    if (res.kind === "unknown" || res.kind === "same") {
      const source = sourceLanguageOf(original);
      if (source && source !== mode) {
        const translated = machine(original, source, mode);
        if (translated) {
          stats.ok++;
          return retainOuterWhitespace(original, translated);
        }
      }
    }
    return original;
  }

  function toEton(text, language) {
    if (!criticalData) return null;
    const structured = T.translate(text, { target: "eton", pageLanguage: language });
    return structured && typeof structured.eton === "string" && structured.eton.trim() && structured.marqueurs_ok !== false
      ? structured.eton
      : null;
  }

  function sourceLanguageOf(text) {
    return T.guessLanguage(text) || pageLanguage;
  }

  // Traduction locale de secours (voir src/engine/mt.js). Renvoie null tant qu'elle n'est pas prête.
  function machine(text, source, target) {
    if (!NS.mt) return null;
    return NS.mt.lookup(text, source, target) || null;
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

  // Le libellé d'un bouton <input> est son attribut value. On ne le traduit que s'il n'est
  // pas envoyé avec le formulaire (pas d'attribut name).
  function attrsOf(el) {
    const list = ATTRS.filter((a) => el.hasAttribute(a));
    if (el.tagName === "INPUT" && BUTTON_INPUTS.has(el.type) && !el.name && el.hasAttribute("value")) list.push("value");
    return list;
  }

  function writeAttrs(el) {
    let map = attrState.get(el);
    if (!map) attrState.set(el, (map = {}));
    for (const a of attrsOf(el)) {
      const st = map[a] || (map[a] = {});
      const desired = decide(st, el.getAttribute(a));
      if (el.getAttribute(a) !== desired) el.setAttribute(a, desired);
      st.written = desired;
    }
  }

  // Zones que l'auteur du site ou l'utilisateur contrôlent : jamais modifiées.
  function isProtectedElement(el) {
    if (el.id === HOST_ID) return true; // panneau ALPHA
    if (el.isContentEditable) return true;
    if (el.getAttribute("translate") === "no" || el.classList.contains("notranslate")) return true;
    if (el.namespaceURI === "http://www.w3.org/2000/svg") return true;
    // Une option sans attribut value envoie son texte avec le formulaire.
    if (el.tagName === "OPTION" && !el.hasAttribute("value")) return true;
    return false;
  }

  // Parcourt le document et les Shadow DOM ouverts (composants Web).
  function collect(root, nodes, attrEls, roots) {
    roots.push(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (n.nodeType === Node.TEXT_NODE) {
          return n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
        if (isProtectedElement(n)) return NodeFilter.FILTER_REJECT;
        if (attrsOf(n).length) attrEls.push(n);
        if (SKIP_TAGS.has(n.tagName)) return NodeFilter.FILTER_REJECT;
        if (n.shadowRoot) collect(n.shadowRoot, nodes, attrEls, roots);
        return NodeFilter.FILTER_SKIP;
      },
    });
    while (walker.nextNode()) nodes.push(walker.currentNode);
  }

  function apply() {
    if (!dict || !document.body) return;
    const t0 = performance.now();
    if (observer) observer.disconnect(); // nos propres écritures ne doivent pas relancer le scan
    stats = { ok: 0, total: 0 };

    const nodes = [];
    const attrEls = [];
    const roots = [];
    collect(document.body, nodes, attrEls, roots);
    roots.forEach((root) => collectTyped(root));
    const sourceSamples = nodes.slice(0, 400).map((node) => {
      const state = textState.get(node);
      return state && state.orig !== undefined ? state.orig : node.nodeValue;
    });
    pageLanguage = T.detectPageLanguage(document.documentElement.getAttribute("lang"), sourceSamples);
    nodes.forEach(writeText);
    attrEls.forEach(writeAttrs);

    lastCost = performance.now() - t0;
    if (panel) panel.update(stats, mode, pageLanguage);
    if (observer) roots.forEach((root) => observer.observe(root, OBSERVE));
  }

  // Une traduction locale vient d'arriver : nouveau passage, regroupé.
  let applyTimer = null;
  function scheduleApply(delay) {
    if (applyTimer) return;
    applyTimer = setTimeout(() => {
      applyTimer = null;
      apply();
    }, delay);
  }

  function machinePairs(next) {
    if (next === "en") return [["fr", "en"]];
    if (next === "fr" || next === "local") return [["en", "fr"]];
    return [];
  }

  function setMode(next) {
    if (!["original", "fr", "en", "local"].includes(next)) return;
    mode = next;
    // Appelé pendant le clic : Chrome autorise alors la préparation du modèle hors ligne.
    if (NS.mt) NS.mt.prepare(machinePairs(next));
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

  // Message du panneau sur l'état de la traduction hors ligne des contenus nouveaux.
  const MT_NOTICES = {
    "needs-activation": "Choisissez une langue pour activer la traduction hors ligne des contenus nouveaux.",
    downloading: "Préparation de la traduction hors ligne des contenus nouveaux…",
    unsupported: "Ce navigateur ne traduit que les textes connus d’ALPHA.",
    unavailable: "Ce navigateur ne traduit que les textes connus d’ALPHA.",
  };
  function showMachineStatus(status) {
    if (panel && panel.setNotice) panel.setNotice(mode === "original" ? "" : MT_NOTICES[status] || "");
  }

  async function init() {
    if (document.getElementById(HOST_ID)) return; // déjà lancé
    if (!document.body) return;
    // Dans un cadre (iframe), on traduit aussi, sauf les cadres minuscules (publicités, pixels).
    if (!IS_TOP && (window.innerWidth < 120 || window.innerHeight < 40)) return;
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

    // Le panneau n'apparaît que dans la page principale ; les cadres suivent son choix.
    if (IS_TOP) {
      panel = NS.panel.create({
        hostId: HOST_ID,
        onModeChange: setMode,
        onSpeak: speakVisibleText,
        onZoomChange: setZoom,
      });
    }
    try {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "local" || !changes.alphaMode) return;
        const next = changes.alphaMode.newValue;
        if (next === mode || !["original", "fr", "en", "local"].includes(next)) return;
        mode = next;
        apply();
      });
    } catch (e) {
      /* stockage indisponible : chaque cadre garde son choix */
    }

    // Saisies de l'utilisateur, pour ne jamais traduire leur réaffichage.
    const onTyped = (event) => {
      const field = event.target;
      if (field && (field.tagName === "TEXTAREA" || (field.tagName === "INPUT" && TYPED_INPUTS.has(field.type)))) {
        rememberTyped(field);
      }
    };
    document.addEventListener("input", onTyped, true);
    document.addEventListener("change", onTyped, true);

    if (NS.mt) {
      NS.mt.onResult(() => scheduleApply(40));
      NS.mt.onStatus(showMachineStatus);
    }

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
    showMachineStatus(NS.mt ? NS.mt.status() : "unsupported");
    languageObserver = new MutationObserver(() => apply());
    languageObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["lang"],
    });
  }

  init().catch((e) => console.error("[ALPHA] démarrage impossible :", e));
})();
