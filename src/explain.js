/* Action « Expliquer » : explique les termes financiers d'un texte sélectionné à l'aide
   d'un glossaire vérifié (data/glossary.json). Aucun modèle d'IA, aucune connexion :
   la sélection n'est ni stockée ni transmise. */
(function () {
  "use strict";

  const NS = (globalThis.ALPHA = globalThis.ALPHA || {});
  const MAX_RESULTS = 3;

  let data = null;
  let terms = []; // { key, entry }, du plus long au plus court

  // Forme de recherche : sans accents, minuscules, ponctuation remplacée par des espaces.
  function key(text) {
    return " " + String(text == null ? "" : text)
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[‘’ʼ`]/g, "'")
      .replace(/[^\p{L}\p{N}']+/gu, " ")
      .replace(/\s+/g, " ")
      .trim() + " ";
  }

  function init(glossary) {
    data = glossary || null;
    terms = [];
    for (const entry of (data && data.entries) || []) {
      for (const list of Object.values(entry.terms || {})) {
        for (const term of list) {
          const k = key(term);
          if (k.trim()) terms.push({ key: k, entry });
        }
      }
    }
    terms.sort((a, b) => b.key.length - a.key.length);
  }

  /* Termes du glossaire présents dans le texte, dans l'ordre d'apparition.
     Le terme le plus long l'emporte (« total débité » plutôt que « débit »). */
  function find(text) {
    let haystack = key(text);
    const found = [];
    for (const { key: k, entry } of terms) {
      let index = haystack.indexOf(k);
      while (index >= 0) {
        found.push({ index, entry });
        // On efface le passage reconnu pour qu'un terme plus court ne le reprenne pas.
        haystack = haystack.slice(0, index + 1) + " ".repeat(k.length - 2) + haystack.slice(index + k.length - 1);
        index = haystack.indexOf(k);
      }
    }
    found.sort((a, b) => a.index - b.index);
    const seen = new Set();
    return found.filter(({ entry }) => !seen.has(entry.id) && seen.add(entry.id)).map(({ entry }) => entry);
  }

  function uiFor(lang) {
    const ui = (data && data.meta && data.meta.ui) || {};
    return ui[lang] || ui.fr || {};
  }

  // mode : "fr" | "en" | "local" | "original" ; pageLanguage : "fr" | "en" | null
  function languageFor(mode, pageLanguage) {
    return mode === "en" || (mode === "original" && pageLanguage === "en") ? "en" : "fr";
  }

  /* Explication prête à afficher et à lire, ou null si aucun terme n'est reconnu. */
  function explain(text, mode, pageLanguage) {
    const entries = find(text).slice(0, MAX_RESULTS);
    if (!entries.length) return null;
    const lang = languageFor(mode, pageLanguage);
    const ui = uiFor(lang);
    const items = entries.map((entry) => {
      const texts = (mode === "local" && entry.local) || entry[lang] || entry.fr;
      return { id: entry.id, term: texts.term, text: texts.text };
    });
    const etonPending = mode === "local" && entries.some((entry) => !entry.local);
    return {
      lang,
      items,
      title: ui.title,
      note: etonPending ? ui.etonPending + " " + ui.source : ui.source,
      speech: items.map((item) => item.term + ". " + item.text).join(" "),
    };
  }

  NS.explain = { init, find, explain, ui: uiFor, languageFor };
})();
