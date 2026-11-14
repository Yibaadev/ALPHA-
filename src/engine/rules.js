/* Application de patrons explicitement validés et de verbes vérifiés du lexique. */
(function () {
  "use strict";

  const NS = (globalThis.ALPHA = globalThis.ALPHA || {});
  const COMMON = NS.engineCommon;
  const { normalizeForComparison, sameArray, markerTokens, numericTokens, normalizeCriticalTerms } = COMMON;
  let rules = [];
  let activeRules = [];
  let verbs = [];
  let protectionRegex = null;
  let criticalTerms = [];
  let criticalTermsReady = false;
  let ignored = new Set();

  function render(template, verb, placeholder) {
    if (typeof template !== "string") return null;
    const expression = new RegExp("\\{" + placeholder + "\\}", "g");
    return template.replace(expression, verb);
  }

  function validTemplate(rule) {
    const pattern = rule && rule.pattern;
    if (!pattern || typeof pattern !== "object" ||
        typeof pattern.fr !== "string" || typeof pattern.eton !== "string" ||
        typeof pattern.verbe_fr !== "string" || !pattern.verbe_fr.trim()) return false;
    if ((pattern.fr.match(/\{verbe_fr\}/g) || []).length > 1) return false;
    if ((pattern.eton.match(/\{verbe_eton\}/g) || []).length !== 1) return false;
    if (/\{(?!verbe_fr\})[^}]+\}/.test(pattern.fr) || /\{(?!verbe_eton\})[^}]+\}/.test(pattern.eton)) return false;
    return typeof rule.example_fr === "string" && typeof rule.example_eton === "string" &&
      Boolean(rule.example_fr.trim()) && Boolean(rule.example_eton.trim());
  }

  function renderForVerb(rule, verb) {
    const pattern = rule.pattern;
    if (pattern.verbe_fr !== "{verbe_fr}" &&
        normalizeForComparison(pattern.verbe_fr) !== normalizeForComparison(verb.fr)) return null;
    const fr = render(pattern.fr, verb.fr, "verbe_fr");
    const eton = render(pattern.eton, verb.eton, "verbe_eton");
    if (fr === null || eton === null) return null;
    return { fr, eton };
  }

  function verbsForRule(rule) {
    if (rule.pattern.verbe_fr === "{verbe_fr}") return verbs;
    return verbs.filter((verb) =>
      normalizeForComparison(rule.pattern.verbe_fr) === normalizeForComparison(verb.fr)
    );
  }

  function activeMatches(rule) {
    if (!rule || rule.statut !== "verifie" || !rule.verifie_par || !rule.date || !validTemplate(rule)) return [];
    const renderedVerbs = [];
    for (const verb of verbsForRule(rule)) {
      const rendered = renderForVerb(rule, verb);
      if (rendered) renderedVerbs.push({ verb, rendered });
    }
    const exampleIsBackedByLexicon = renderedVerbs.some(({ rendered }) =>
      normalizeForComparison(rendered.fr) === normalizeForComparison(rule.example_fr) &&
      rendered.eton === rule.example_eton
    );
    return exampleIsBackedByLexicon ? renderedVerbs : [];
  }

  function init(ruleData, lexicon, criticalData, meta) {
    if (!NS.protect) throw new Error("ALPHA.protect doit être chargé avant le moteur rules.");
    protectionRegex = NS.protect.build(meta && meta.names || []);
    ignored = new Set(((meta && meta.ignore) || []).map((value) => NS.protect.normalize(String(value))));
    rules = Array.isArray(ruleData) ? ruleData : [];
    verbs = (Array.isArray(lexicon) ? lexicon : []).filter((entry) =>
      entry && typeof entry.fr === "string" && typeof entry.eton === "string" &&
      entry.fr.trim() && entry.eton.trim() &&
      (entry.statut === "valide" || entry.statut === "verifie") &&
      /^v(?:\.|\s|$)/i.test(String(entry.pos || "")) &&
      !/\[M\d+\]|\d/u.test(entry.fr) && !/\[M\d+\]|\d/u.test(entry.eton)
    );
    criticalTerms = normalizeCriticalTerms(criticalData);
    criticalTermsReady = Boolean(criticalData && criticalData.langue_source === "fr" && criticalTerms.length);
    activeRules = criticalTermsReady ? rules.filter((rule) => activeMatches(rule).length > 0) : [];
    return activeRules.length;
  }

  function result(original, eton, statut, source, score, marqueursOk, raisons) {
    return { original, eton, statut, source, score, marqueurs_ok: marqueursOk, raisons };
  }

  function noMatch(original, reason, marqueursOk) {
    return result(original, null, "non_traduit", "aucune", 0, marqueursOk !== false, [reason]);
  }

  function match(text) {
    const original = String(text == null ? "" : text);
    if (!protectionRegex) return noMatch(original, "Le moteur règles n’est pas initialisé.");
    if (!criticalTermsReady) return noMatch(original, "La liste française des termes critiques est absente ou invalide.");
    if (ignored.has(NS.protect.normalize(original))) return noMatch(original, "Texte ignoré par la configuration.");
    if (COMMON.containsCriticalTerm(original, criticalTerms)) {
      return noMatch(original, "Phrase critique : le moteur de règles est interdit.");
    }

    const source = NS.protect.protect(original, protectionRegex);
    const candidates = [];
    for (const rule of activeRules) {
      for (const active of activeMatches(rule)) {
        if (normalizeForComparison(source.masked) !== normalizeForComparison(active.rendered.fr)) continue;
        candidates.push({ rule, active });
      }
    }
    const outputs = new Set(candidates.map((candidate) => candidate.active.rendered.eton));
    if (!candidates.length) return noMatch(original, "Aucune règle vérifiée ne correspond exactement à un verbe vérifié du lexique.");
    if (outputs.size !== 1) return noMatch(original, "Plusieurs règles vérifiées produisent des sorties différentes.");

    const candidate = candidates[0];
    const targetMarkers = markerTokens(candidate.active.rendered.eton);
    if (!sameArray(markerTokens(source.masked), targetMarkers) ||
        !sameArray(numericTokens(source.masked), numericTokens(candidate.active.rendered.eton))) {
      return noMatch(original, "La signature des marqueurs ou des chiffres diffère.", false);
    }
    const restored = NS.protect.restore(candidate.active.rendered.eton, source.values);
    if (restored === null) return noMatch(original, "La restauration des valeurs protégées a échoué.", false);
    const checked = NS.protect.protect(restored, protectionRegex);
    if (!sameArray(source.values, checked.values) ||
        !sameArray(markerTokens(source.masked), markerTokens(checked.masked)) ||
        !sameArray(numericTokens(source.masked), numericTokens(checked.masked))) {
      return noMatch(original, "L’intégrité des valeurs protégées n’a pas été confirmée.", false);
    }

    return result(
      original,
      restored,
      "probable",
      "regles",
      1,
      true,
      ["Règle vérifiée utilisée : " + candidate.rule.id + ".", "Exemple validé : « " + candidate.rule.example_fr + " » → « " + candidate.rule.example_eton + " ». "]
    );
  }

  NS.rules = {
    init,
    match,
    normalizeForComparison,
  };
})();
