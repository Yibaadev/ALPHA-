/* Fonctions partagées par les moteurs de traduction. */
(function () {
  "use strict";

  const NS = (globalThis.ALPHA = globalThis.ALPHA || {});
  const MARKER_RE = /\[M\d+\]/g;

  // Normalise uniquement les clés de recherche; le texte affiché reste inchangé.
  function normalizeForComparison(value) {
    return String(value == null ? "" : value)
      .replace(/\[M(\d+)\]/g, " marker$1 ")
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[‘’ʼ`]/g, "'")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function sameArray(left, right) {
    return left.length === right.length && left.every((value, index) => value === right[index]);
  }

  function markerTokens(text) {
    return String(text).match(MARKER_RE) || [];
  }

  function numericTokens(maskedText) {
    return String(maskedText).replace(MARKER_RE, " ").match(/\d+(?:[.,]\d+)*/g) || [];
  }

  // Conserve la catégorie, utilisée par le contrôle de polarité du moteur fuzzy.
  function normalizeCriticalTerms(data) {
    const categories = data && data.categories && typeof data.categories === "object" ? data.categories : {};
    const output = [];
    for (const [category, terms] of Object.entries(categories)) {
      for (const value of Array.isArray(terms) ? terms : []) {
        const term = normalizeForComparison(value);
        if (term) output.push({ category, term });
      }
    }
    return output;
  }

  // Compare des termes complets pour éviter les correspondances au milieu d'un mot.
  function containsCriticalTerm(text, terms) {
    const normalized = normalizeForComparison(text);
    for (const entry of terms || []) {
      const term = typeof entry === "string" ? entry : entry && entry.term;
      if (!term) continue;
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
      if (new RegExp("(?:^|\\s)" + escaped + "(?=$|\\s)").test(normalized)) return true;
    }
    return false;
  }

  NS.engineCommon = {
    normalizeForComparison,
    sameArray,
    markerTokens,
    numericTokens,
    normalizeCriticalTerms,
    containsCriticalTerm,
  };
})();
