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
  let speaking = false;
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

  // Réserve la synthèse du navigateur au français et à l'anglais avec une voix marquée locale.
  function speakVisibleText() {
    if (!panel) return;
    if (mode === "local") {
      panel.setVoiceStatus("La synthèse Eton est désactivée. Il faudra intégrer des enregistrements natifs validés.");
      return;
    }
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

    const text = (document.body.innerText || "").replace(/\s+/g, " ").trim().slice(0, 4000);
    if (!text) {
      panel.setVoiceStatus("Aucun texte visible à lire.");
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    const language = mode === "en" ? "en-US" : "fr-FR";
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
    panel.setVoiceStatus("Lecture locale en cours…");
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
    const res = await fetch(chrome.runtime.getURL("data/dictionary.json"));
    dict = await res.json();
    T.init(dict);

    const saved = await readSavedMode();
    if (["original", "fr", "en", "local"].includes(saved)) mode = saved;

    panel = NS.panel.create({
      hostId: HOST_ID,
      onModeChange: setMode,
      onCopyUnknown: copyUnknown,
      onSpeak: speakVisibleText,
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
  }

  init().catch((e) => console.error("[SAFINUM] démarrage impossible :", e));
})();
