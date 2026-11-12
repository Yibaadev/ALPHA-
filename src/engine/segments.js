/* Assemblage prudent de segments issus de données linguistiques vérifiées. */
(function () {
  "use strict";

  const NS = (globalThis.SAFINUM = globalThis.SAFINUM || {});
  const DEFAULT_COVERAGE_THRESHOLD = 0.80;
  const MARKER_RE = /\[M\d+\]/g;
  const WORD_RE = /\[M\d+\]|[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*/gu;
  let vocabulary = new Map();
  let protectionRegex = null;
  let criticalTerms = [];
  let criticalTermsReady = false;
  let ignored = new Set();
  let baseOptions = { coverageThreshold: DEFAULT_COVERAGE_THRESHOLD };

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

  function sameArray(a, b) {
    return a.length === b.length && a.every((value, i) => value === b[i]);
  }

  function markerTokens(text) {
    return String(text).match(MARKER_RE) || [];
  }

  function numericTokens(maskedText) {
    return String(maskedText).replace(MARKER_RE, " ").match(/\d+(?:[.,]\d+)*/g) || [];
  }

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

  function containsCriticalTerm(text) {
    const normalized = normalizeForComparison(text);
    for (const { term } of criticalTerms) {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
      const expression = new RegExp("(?:^|\\s)" + escaped + "(?=$|\\s)", "g");
      if (expression.test(normalized)) return true;
    }
    return false;
  }

  function addEntry(source, target, status, conflicts) {
    if ((status !== "valide" && status !== "verifie") ||
        typeof source !== "string" || typeof target !== "string" ||
        !source.trim() || !target.trim() || /\[M\d+\]|\d/u.test(source) ||
        /\[M\d+\]|\d/u.test(target)) return;

    const key = normalizeForComparison(source);
    if (!key || !/\p{L}/u.test(key) || conflicts.has(key)) return;
    const current = vocabulary.get(key);
    if (!current) {
      vocabulary.set(key, { source, target });
    } else if (current.target !== target) {
      vocabulary.delete(key);
      conflicts.add(key);
    }
  }

  function init(dictionary, lexicon, criticalData, options) {
    if (!NS.protect) throw new Error("SAFINUM.protect doit être chargé avant le moteur segments.");
    const data = dictionary || {};
    const meta = data.meta || {};
    protectionRegex = NS.protect.build(meta.names || []);
    ignored = new Set((meta.ignore || []).map((value) => NS.protect.normalize(String(value))));
    vocabulary = new Map();
    const conflicts = new Set();

    for (const entry of data.entries || []) {
      if (!entry) continue;
      addEntry(entry.fr, entry.local, entry.statut, conflicts);
    }
    for (const entry of Array.isArray(lexicon) ? lexicon : []) {
      if (!entry) continue;
      addEntry(entry.fr, entry.eton, entry.statut, conflicts);
    }

    criticalTerms = normalizeCriticalTerms(criticalData);
    criticalTermsReady = Boolean(
      criticalData && criticalData.langue_source === "fr" && criticalTerms.length
    );
    baseOptions = { coverageThreshold: DEFAULT_COVERAGE_THRESHOLD, ...(options || {}) };
    return criticalTermsReady ? vocabulary.size : 0;
  }

  function getCoverageThreshold(options) {
    const merged = { ...baseOptions, ...(options || {}) };
    const value = Number(merged.coverageThreshold);
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : DEFAULT_COVERAGE_THRESHOLD;
  }

  function result(original, eton, statut, source, score, marqueursOk, raisons) {
    return { original, eton, statut, source, score, marqueurs_ok: marqueursOk, raisons };
  }

  function noMatch(original, reason, score, marqueursOk) {
    return result(original, null, "non_traduit", "aucune", score || 0, marqueursOk !== false, [reason]);
  }

  function tokens(text) {
    return Array.from(String(text).matchAll(WORD_RE), (match) => ({
      value: match[0],
      start: match.index,
      end: match.index + match[0].length,
      marker: /^\[M\d+\]$/.test(match[0]),
    }));
  }

  function canSpan(text, words, first, last) {
    for (let i = first; i < last; i++) {
      const between = text.slice(words[i].end, words[i + 1].start);
      if (!/^\s+$/u.test(between)) return false;
    }
    const span = text.slice(words[first].start, words[last].end);
    return !/\[M\d+\]|\d/u.test(span);
  }

  function match(originalText, options) {
    const original = String(originalText == null ? "" : originalText);
    const threshold = getCoverageThreshold(options);
    if (!protectionRegex) return noMatch(original, "Le moteur segments n’est pas initialisé.");
    if (!criticalTermsReady) return noMatch(original, "La liste française des termes critiques est absente ou invalide.");
    if (ignored.has(NS.protect.normalize(original))) return noMatch(original, "Texte ignoré par la configuration.");
    if (containsCriticalTerm(original)) {
      return noMatch(original, "Phrase critique : l’assemblage de segments est interdit.");
    }

    const source = NS.protect.protect(original, protectionRegex);
    const wordTokens = tokens(source.masked).filter((token) => !token.marker);
    if (!wordTokens.length) return noMatch(original, "Aucun mot non protégé à segmenter.");

    const replacements = [];
    let coveredWords = 0;
    for (let first = 0; first < wordTokens.length;) {
      let selected = null;
      for (let last = wordTokens.length - 1; last >= first; last--) {
        if (!canSpan(source.masked, wordTokens, first, last)) continue;
        const span = source.masked.slice(wordTokens[first].start, wordTokens[last].end);
        const entry = vocabulary.get(normalizeForComparison(span));
        if (entry) {
          selected = { first, last, start: wordTokens[first].start, end: wordTokens[last].end, entry };
          break;
        }
      }
      if (!selected) {
        first++;
        continue;
      }
      replacements.push(selected);
      coveredWords += selected.last - selected.first + 1;
      first = selected.last + 1;
    }

    const coverage = coveredWords / wordTokens.length;
    if (coverage < threshold || !replacements.length) {
      const percent = Math.round(coverage * 100);
      return noMatch(
        original,
        "Couverture de " + percent + "% (" + coveredWords + "/" + wordTokens.length + " mots); seuil requis : " + Math.round(threshold * 100) + "%. Le texte original est conservé. Les mots non couverts restent en français.",
        Math.round(coverage * 1e6) / 1e6
      );
    }

    let outputMasked = "";
    let cursor = 0;
    for (const replacement of replacements) {
      outputMasked += source.masked.slice(cursor, replacement.start) + replacement.entry.target;
      cursor = replacement.end;
    }
    outputMasked += source.masked.slice(cursor);

    if (!sameArray(markerTokens(source.masked), markerTokens(outputMasked)) ||
        !sameArray(numericTokens(source.masked), numericTokens(outputMasked))) {
      return noMatch(original, "L’assemblage a modifié la signature des marqueurs ou des chiffres.", coverage, false);
    }
    const restored = NS.protect.restore(outputMasked, source.values);
    if (restored === null) return noMatch(original, "La restauration des valeurs protégées a échoué.", coverage, false);
    const checked = NS.protect.protect(restored, protectionRegex);
    if (!sameArray(source.values, checked.values) ||
        !sameArray(markerTokens(source.masked), markerTokens(checked.masked)) ||
        !sameArray(numericTokens(source.masked), numericTokens(checked.masked))) {
      return noMatch(original, "L’intégrité des valeurs protégées n’a pas été confirmée.", coverage, false);
    }

    return result(
      original,
      restored,
      "probable",
      "segments",
      Math.round(coverage * 1e6) / 1e6,
      true,
      [
        "Couverture de " + Math.round(coverage * 100) + "% (" + coveredWords + "/" + wordTokens.length + " mots non protégés).",
        "Les portions sans entrée vérifiée restent en français.",
      ]
    );
  }

  NS.segments = {
    DEFAULT_COVERAGE_THRESHOLD,
    init,
    match,
    normalizeForComparison,
  };
})();
