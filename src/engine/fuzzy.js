/* Appariement flou prudent sur des références françaises déjà vérifiées. */
(function () {
  "use strict";

  const NS = (globalThis.ALPHA = globalThis.ALPHA || {});
  const DEFAULT_THRESHOLD = 0.90;
  const DEFAULTS = {
    threshold: DEFAULT_THRESHOLD,
    ambiguityMargin: 0.02,
    referenceSimilarityThreshold: 0.85,
  };
  const MARKER_RE = /\[M\d+\]/g;
  let references = [];
  let protectionRegex = null;
  let criticalTerms = [];
  let criticalTermsReady = false;
  let ignored = new Set();
  let baseOptions = { ...DEFAULTS };

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

  function levenshteinDistance(left, right) {
    const a = Array.from(left);
    const b = Array.from(right);
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const current = [i];
      for (let j = 1; j <= b.length; j++) {
        current[j] = Math.min(
          current[j - 1] + 1,
          previous[j] + 1,
          previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
        );
      }
      previous = current;
    }
    return previous[b.length];
  }

  function levenshteinSimilarity(left, right) {
    if (left === right) return 1;
    const maxLength = Math.max(Array.from(left).length, Array.from(right).length);
    return maxLength ? 1 - levenshteinDistance(left, right) / maxLength : 1;
  }

  function ngramCounts(value, n) {
    const chars = Array.from(value);
    const counts = new Map();
    if (chars.length < n) {
      if (chars.length) counts.set(chars.join(""), 1);
      return counts;
    }
    for (let i = 0; i <= chars.length - n; i++) {
      const gram = chars.slice(i, i + n).join("");
      counts.set(gram, (counts.get(gram) || 0) + 1);
    }
    return counts;
  }

  function ngramDice(left, right, ngramSize) {
    if (left === right) return 1;
    if (!left || !right) return 0;
    const n = Math.max(1, Math.min(ngramSize || 3, Array.from(left).length, Array.from(right).length));
    const a = ngramCounts(left, n);
    const b = ngramCounts(right, n);
    let intersection = 0;
    let totalA = 0;
    let totalB = 0;
    for (const count of a.values()) totalA += count;
    for (const count of b.values()) totalB += count;
    for (const [gram, count] of a) intersection += Math.min(count, b.get(gram) || 0);
    return totalA + totalB ? (2 * intersection) / (totalA + totalB) : 1;
  }

  function similarity(leftText, rightText, options) {
    const left = normalizeForComparison(leftText);
    const right = normalizeForComparison(rightText);
    const levenshtein = levenshteinSimilarity(left, right);
    const ngrams = ngramDice(left, right, options && options.ngramSize || 3);
    return {
      score: Math.round((0.8 * levenshtein + 0.2 * ngrams) * 1e6) / 1e6,
      levenshtein: Math.round(levenshtein * 1e6) / 1e6,
      ngrams: Math.round(ngrams * 1e6) / 1e6,
    };
  }

  function sameArray(a, b) {
    return a.length === b.length && a.every((value, i) => value === b[i]);
  }

  function markerTokens(text) {
    return String(text).match(MARKER_RE) || [];
  }

  function numericTokens(maskedText) {
    const withoutMarkers = String(maskedText).replace(MARKER_RE, " ");
    return withoutMarkers.match(/\d+(?:[.,]\d+)*/g) || [];
  }

  function shape(text) {
    const protectedText = NS.protect.protect(String(text == null ? "" : text), protectionRegex);
    return {
      masked: protectedText.masked,
      values: protectedText.values,
      markers: markerTokens(protectedText.masked),
      numbers: numericTokens(protectedText.masked),
    };
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

  function criticalSignature(text) {
    const normalized = normalizeForComparison(text);
    const found = [];
    for (const { category, term } of criticalTerms) {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
      const expression = new RegExp("(?:^|\\s)" + escaped + "(?=$|\\s)", "g");
      for (const _match of normalized.matchAll(expression)) found.push(category + ":" + term);
    }
    return found.sort();
  }

  function hasCriticalTerms(signature) {
    return signature.length > 0;
  }

  function validMarkerSequence(markers, count) {
    if (markers.length !== count) return false;
    return markers.every((marker, i) => marker === "[M" + (i + 1) + "]");
  }

  function candidateRejection(source, reference, target) {
    const expected = Array.from({ length: source.values.length }, (_, i) => "[M" + (i + 1) + "]");
    if (!validMarkerSequence(source.markers, source.values.length) ||
        !sameArray(source.markers, reference.markers) ||
        !sameArray(source.markers, target.markers)) {
      return "La signature ou l’ordre des marqueurs diffère.";
    }
    if (!sameArray(source.numbers, reference.numbers) || !sameArray(source.numbers, target.numbers)) {
      return "La signature des chiffres diffère.";
    }

    const sourceCritical = criticalSignature(source.masked);
    const referenceCritical = criticalSignature(reference.masked);
    const targetCritical = criticalSignature(target.masked);
    const anyCritical = hasCriticalTerms(sourceCritical) || hasCriticalTerms(referenceCritical) || hasCriticalTerms(targetCritical);
    if (anyCritical && (!sameArray(sourceCritical, referenceCritical) || !sameArray(sourceCritical, targetCritical))) {
      return "Les termes critiques diffèrent entre la phrase et la référence.";
    }
    if (anyCritical) return "Une phrase critique doit correspondre exactement; le fuzzy est interdit.";
    if (expected.length !== source.markers.length) return "La signature des valeurs protégées est incomplète.";
    return null;
  }

  function result(original, eton, statut, source, score, marqueursOk, raisons) {
    return { original, eton, statut, source, score, marqueurs_ok: marqueursOk, raisons };
  }

  function noMatch(original, reason, extraReasons) {
    return result(original, null, "non_traduit", "aucune", 0, true, [reason].concat(extraReasons || []));
  }

  function mergedOptions(options) {
    const merged = { ...baseOptions, ...(options || {}) };
    if (!Number.isFinite(merged.threshold)) merged.threshold = DEFAULT_THRESHOLD;
    merged.threshold = Math.max(0, Math.min(1, merged.threshold));
    if (!Number.isFinite(merged.ambiguityMargin) || merged.ambiguityMargin < 0) merged.ambiguityMargin = DEFAULTS.ambiguityMargin;
    if (!Number.isFinite(merged.referenceSimilarityThreshold)) merged.referenceSimilarityThreshold = DEFAULTS.referenceSimilarityThreshold;
    return merged;
  }

  function init(dictionary, criticalData, options) {
    if (!NS.protect) throw new Error("ALPHA.protect doit être chargé avant le moteur fuzzy.");
    const data = dictionary || {};
    const meta = data.meta || {};
    protectionRegex = NS.protect.build(meta.names || []);
    ignored = new Set((meta.ignore || []).map((value) => NS.protect.normalize(String(value))));
    references = (data.entries || []).filter((entry) =>
      entry && entry.fr && entry.local && String(entry.local).trim() &&
      (entry.statut === "valide" || entry.statut === "verifie")
    );
    criticalTerms = normalizeCriticalTerms(criticalData);
    criticalTermsReady = Boolean(
      criticalData && criticalData.langue_source === "fr" && criticalTerms.length
    );
    baseOptions = { ...DEFAULTS, ...(options || {}) };
    return criticalTermsReady ? references.length : 0;
  }

  function match(text, options) {
    const original = String(text == null ? "" : text);
    const config = mergedOptions(options);
    if (!protectionRegex) return noMatch(original, "Le moteur fuzzy n’est pas initialisé.");
    if (!criticalTermsReady) return noMatch(original, "La liste française des termes critiques est absente ou invalide.");
    if (ignored.has(NS.protect.normalize(original))) return noMatch(original, "Texte ignoré par la configuration.");

    const source = shape(original);
    if (!/\p{L}/u.test(source.masked.replace(MARKER_RE, ""))) {
      return noMatch(original, "Aucun texte lexical à comparer.");
    }
    const sourceCritical = criticalSignature(source.masked);
    if (hasCriticalTerms(sourceCritical)) {
      return noMatch(original, "Phrase critique : seule une correspondance exacte ou un gabarit validé est autorisé.");
    }

    const candidates = [];
    for (const entry of references) {
      const reference = shape(entry.fr);
      const target = shape(entry.local);
      const rejection = candidateRejection(source, reference, target);
      if (rejection) continue;
      const comparison = similarity(source.masked, reference.masked, config);
      if (comparison.score < config.threshold) continue;
      candidates.push({ entry, reference, target, comparison });
    }

    if (!candidates.length) {
      return noMatch(original, "Aucune référence vérifiée ne dépasse le seuil fuzzy de " + config.threshold.toFixed(2) + ".");
    }
    candidates.sort((a, b) => b.comparison.score - a.comparison.score || String(a.entry.id).localeCompare(String(b.entry.id)));
    const best = candidates[0];
    const near = candidates.filter((candidate) => best.comparison.score - candidate.comparison.score <= config.ambiguityMargin);
    let dissimilarReferences = false;
    for (let i = 0; i < near.length; i++) {
      for (let j = i + 1; j < near.length; j++) {
        const pair = similarity(near[i].reference.masked, near[j].reference.masked, config).score;
        if (pair < config.referenceSimilarityThreshold) dissimilarReferences = true;
        if (pair >= config.referenceSimilarityThreshold &&
            normalizeForComparison(near[i].target.masked) !== normalizeForComparison(near[j].target.masked)) {
          dissimilarReferences = true;
        }
      }
    }
    if (near.length > 1 && dissimilarReferences) {
      return noMatch(original, "Ambiguïté : plusieurs références proches ne désignent pas la même phrase.");
    }

    const restored = NS.protect.restore(best.target.masked, source.values);
    if (restored === null) {
      return noMatch(original, "La restauration des valeurs protégées a échoué.");
    }
    const restoredShape = shape(restored);
    if (!sameArray(source.values, restoredShape.values) ||
        !sameArray(source.markers, restoredShape.markers) ||
        !sameArray(source.numbers, restoredShape.numbers)) {
      return noMatch(original, "L’intégrité des marqueurs ou des chiffres n’a pas été confirmée.");
    }

    return result(
      original,
      restored,
      "probable",
      "fuzzy",
      best.comparison.score,
      true,
      [
        "Référence française utilisée : « " + best.entry.fr + " » (" + best.entry.id + ").",
        "Score fuzzy : " + best.comparison.score.toFixed(3) + " (seuil " + config.threshold.toFixed(2) + ").",
      ]
    );
  }

  NS.fuzzy = {
    DEFAULT_THRESHOLD,
    init,
    match,
    similarity,
    levenshteinDistance,
    levenshteinSimilarity,
    ngramDice,
    normalizeForComparison,
  };
})();
