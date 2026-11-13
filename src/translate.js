/* Repère la langue des textes et renvoie la traduction demandée si elle est sûre.
   La détection utilise l'attribut lang de la page puis les phrases du dictionnaire. */
(function () {
  "use strict";
  const NS = globalThis.ALPHA;
  const P = NS.protect;

  let index = new Map();
  let languageIndexes = { fr: new Map(), en: new Map() };
  let regex = P.build([]);
  let baseNames = [];
  const nameRegexCache = new Map();
  let ignored = new Set();
  let cascade = { ready: false, templates: [], lexicon: [], rules: [], criticalTerms: null };
  let debugTraceEnabled = false;

  function init(dict, options) {
    const meta = dict.meta || {};
    baseNames = meta.names || [];
    regex = P.build(baseNames);
    nameRegexCache.clear();
    ignored = new Set((meta.ignore || []).map(P.normalize));
    index = new Map();
    languageIndexes = { fr: new Map(), en: new Map() };
    for (const e of dict.entries || []) {
      if (e.fr) {
        const key = P.normalize(e.fr);
        index.set(key, e);
        languageIndexes.fr.set(key, e);
      }
      // en_variants : autres formulations anglaises du même texte (ex. libellés d'un site).
      for (const en of [e.en, ...(Array.isArray(e.en_variants) ? e.en_variants : [])]) {
        if (!en || !en.trim()) continue;
        const key = P.normalize(en);
        if (!index.has(key)) index.set(key, e);
        languageIndexes.en.set(key, e);
      }
    }

    const config = options && typeof options === "object" ? options : {};
    const criticalTerms = config.criticalTerms || null;
    cascade = {
      templates: Array.isArray(config.templates) ? config.templates : [],
      lexicon: Array.isArray(config.lexicon) ? config.lexicon : [],
      rules: Array.isArray(config.rules) ? config.rules : [],
      criticalTerms,
      ready: Boolean(criticalTerms && criticalTerms.langue_source === "fr" &&
        criticalTermsIn(criticalTerms).length > 0 && NS.templates && NS.fuzzy && NS.segments && NS.rules),
    };
    if (cascade.ready) {
      NS.fuzzy.init(dict, criticalTerms, config.fuzzyOptions);
      NS.segments.init(dict, cascade.lexicon, criticalTerms, config.segmentOptions);
      NS.rules.init(cascade.rules, cascade.lexicon, criticalTerms, meta);
    }
  }

  function normalizeLanguageTag(tag) {
    const language = String(tag || "").trim().toLowerCase().split(/[-_]/)[0];
    return language === "fr" || language === "en" ? language : null;
  }

  // Détecte une phrase uniquement si elle correspond sans ambiguïté à une langue connue.
  function detectTextLanguage(original) {
    if (ignored.has(P.normalize(original))) return null;
    const { masked } = P.protect(original, regex);
    const key = P.normalize(masked);
    const isFrench = languageIndexes.fr.has(key);
    const isEnglish = languageIndexes.en.has(key);
    if (isFrench === isEnglish) return null;
    return isFrench ? "fr" : "en";
  }

  // Mots très fréquents propres à chaque langue, pour deviner la langue d'un texte inconnu.
  const STOPWORDS = {
    fr: new Set(("le la les un une des du de au aux et ou est sont été être avec pour par sur dans vers votre vos " +
      "nous vous ils elle il ce cette ces qui que ne pas plus sans très mais leur leurs avez avant après " +
      "été sera seront veuillez merci aucun aucune frais solde montant compte").split(" ")),
    en: new Set(("the a an of to and or is are was were be been with for by on in into your our you we they " +
      "it this that these those which who not no more without very but their have has before after will " +
      "please thank any fee fees balance amount account").split(" ")),
  };

  // Devine la langue d'un texte libre. Renvoie null en cas de doute.
  function guessLanguage(text) {
    const known = detectTextLanguage(text);
    if (known) return known;
    const words = String(text || "").toLowerCase().normalize("NFC").match(/\p{L}+/gu) || [];
    if (!words.length) return null;
    let fr = 0;
    let en = 0;
    for (const w of words) {
      if (STOPWORDS.fr.has(w)) fr++;
      if (STOPWORDS.en.has(w)) en++;
    }
    // Les lettres accentuées sont un indice fort de français.
    if (/[àâçéèêëîïôûùüÿœæ]/i.test(text)) fr += 2;
    if (fr === en) return null;
    if (Math.max(fr, en) < 2 && words.length > 3) return null;
    return fr > en ? "fr" : "en";
  }

  // Le contenu réel l'emporte sur l'attribut lang quand il le contredit nettement
  // (beaucoup de sites changent de langue sans mettre à jour <html lang>).
  function detectPageLanguage(pageLang, samples) {
    const declared = normalizeLanguageTag(pageLang);
    const counts = { fr: 0, en: 0 };
    for (const sample of samples || []) {
      const language = guessLanguage(sample);
      if (language) counts[language]++;
    }
    const top = counts.fr === counts.en ? null : counts.fr > counts.en ? "fr" : "en";
    if (!declared) return top;
    if (top && top !== declared) {
      const other = top === "fr" ? counts.en : counts.fr;
      if (counts[top] >= 5 && counts[top] >= 2 * other) return top;
    }
    return declared;
  }

  // Expression de protection étendue aux noms propres inconnus du texte (null s'il n'y en a pas).
  function namesRegexFor(text) {
    const known = new Set(baseNames.map((name) => name.toLowerCase()));
    const extra = P.detectNames(text).filter((name) => !known.has(name.toLowerCase()) && !ignored.has(P.normalize(name)));
    if (!extra.length) return null;
    const key = extra.slice().sort().join("|");
    if (!nameRegexCache.has(key)) {
      if (nameRegexCache.size > 200) nameRegexCache.delete(nameRegexCache.keys().next().value);
      nameRegexCache.set(key, P.build([...baseNames, ...extra]));
    }
    return nameRegexCache.get(key);
  }

  // Exécute fn en protégeant aussi les noms propres inconnus de ce texte.
  function withNames(text, fn) {
    const extended = namesRegexFor(text);
    if (!extended) return fn();
    const saved = regex;
    regex = extended;
    try {
      return fn();
    } finally {
      regex = saved;
    }
  }

  // Masque les valeurs sensibles, noms connus et noms propres repérés dans le texte.
  function protectText(text) {
    const value = String(text == null ? "" : text);
    return P.protect(value, namesRegexFor(value) || regex);
  }

  function markerTokens(text) {
    return String(text).match(/\[M\d+\]/g) || [];
  }

  function sameArray(a, b) {
    return a.length === b.length && a.every((value, i) => value === b[i]);
  }

  // Valide les marqueurs avant restauration, puis revérifie les valeurs restaurées.
  function validateIntegrity(original, candidate, values) {
    const protectedSource = P.protect(original, regex);
    const originalValues = protectedSource.values;
    const expectedMarkers = originalValues.map((_, i) => "[M" + (i + 1) + "]");
    const candidateMarkers = markerTokens(candidate);
    if (!sameArray(expectedMarkers, candidateMarkers)) {
      return { ok: false, text: null, reason: "Les marqueurs sont absents, dupliqués ou réordonnés." };
    }
    if (values && !sameArray(originalValues, values)) {
      return { ok: false, text: null, reason: "Les valeurs protégées ont changé avant restauration." };
    }

    const restored = P.restore(candidate, originalValues);
    if (restored === null) {
      return { ok: false, text: null, reason: "La restauration des marqueurs a échoué." };
    }
    const checked = P.protect(restored, regex);
    if (!sameArray(originalValues, checked.values)) {
      return { ok: false, text: null, reason: "Les valeurs protégées ne sont pas identiques après restauration." };
    }
    const checkedMarkers = originalValues.map((_, i) => "[M" + (i + 1) + "]");
    if (!sameArray(checkedMarkers, markerTokens(checked.masked))) {
      return { ok: false, text: null, reason: "La signature des valeurs protégées a changé." };
    }
    if (!sameArray(numericSignature(original, regex), numericSignature(restored, regex))) {
      return { ok: false, text: null, reason: "La signature des chiffres a changé." };
    }
    return { ok: true, text: restored, values: originalValues, reason: null };
  }

  // Normalisation réservée aux comparaisons. Les chaînes affichées restent inchangées.
  function normalizeForComparison(value) {
    return String(value == null ? "" : value)
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[‘’ʼ]/g, "'")
      .replace(/\p{P}+/gu, " ")
      .replace(/\p{S}+/gu, " ")
      .replace(/[\s  ]+/g, " ")
      .trim();
  }

  function criticalTermsIn(data) {
    const categories = data && data.categories && typeof data.categories === "object" ? data.categories : {};
    return Object.values(categories).flatMap((terms) => Array.isArray(terms) ? terms : [])
      .filter((term) => typeof term === "string" && term.trim());
  }

  function containsCritical(text) {
    const normalize = NS.confidence && NS.confidence.normalize
      ? NS.confidence.normalize
      : normalizeForComparison;
    const normalized = normalize(text);
    return criticalTermsIn(cascade.criticalTerms).some((value) => {
      const term = normalize(value);
      if (!term) return false;
      const escaped = Array.from(term, (character) =>
        "\\^$.*+?()[]{}|".includes(character) ? "\\" + character : character
      ).join("").replaceAll(" ", "\\s+");
      return new RegExp("(?:^|\\s)" + escaped + "(?=$|\\s)").test(normalized);
    });
  }

  function numericSignature(text, protectionRegex) {
    const masked = P.protect(String(text == null ? "" : text), protectionRegex).masked;
    return masked.replace(/\[M\d+\]/g, " ").match(/\d+(?:[.,]\d+)*/g) || [];
  }

  // Engines return restored text except templates, which return markers for this boundary.
  function validateLayerCandidate(original, candidate, templateOutput) {
    if (!candidate || candidate.marqueurs_ok === false || typeof candidate.eton !== "string" || !candidate.eton.trim()) {
      return { ok: false, reason: "La couche n’a pas fourni de traduction intégrité-validée." };
    }
    let output = candidate.eton;
    if (templateOutput) {
      const restored = validateIntegrity(original, output);
      if (!restored.ok) return { ok: false, reason: restored.reason };
      output = restored.text;
    } else if (markerTokens(output).length) {
      return { ok: false, reason: "Un marqueur interne est resté dans la sortie." };
    }

    const source = P.protect(original, regex);
    const target = P.protect(output, regex);
    if (!sameArray(source.values, target.values)) {
      return { ok: false, reason: "Les valeurs protégées diffèrent de la phrase originale." };
    }
    if (!sameArray(numericSignature(original, regex), numericSignature(output, regex))) {
      return { ok: false, reason: "La signature des chiffres diffère de la phrase originale." };
    }
    return { ok: true, text: output };
  }

  function trace(layer, status, accepted) {
    if (!debugTraceEnabled || typeof console === "undefined" || typeof console.debug !== "function") return;
    // Ne jamais écrire le texte de la page ou des valeurs protégées dans la trace.
    console.debug("[ALPHA cascade] couche=" + layer + " statut=" + status + " retenue=" + Boolean(accepted));
  }

  function nonTranslated(original, reason, markersOk) {
    return {
      original, eton: null, statut: "non_traduit", source: "aucune", score: 0,
      marqueurs_ok: markersOk !== false, raisons: [reason],
    };
  }

  function acceptCandidate(original, candidate, templateOutput) {
    const checked = validateLayerCandidate(original, candidate, templateOutput);
    if (!checked.ok) {
      trace(candidate && candidate.source || "inconnue", "rejetée", false);
      return { result: nonTranslated(original, checked.reason, false), rejected: true };
    }
    trace(candidate.source, candidate.statut, true);
    return {
      result: {
        original,
        eton: checked.text,
        statut: candidate.statut,
        source: candidate.source,
        score: Number.isFinite(candidate.score) ? candidate.score : 1,
        marqueurs_ok: true,
        raisons: Array.isArray(candidate.raisons) ? candidate.raisons.slice() : [],
      },
      rejected: false,
    };
  }

  // Résultat interne : { kind: "same" | "skip" | "unknown" | "pending" | "integrity" | "ok", ... }
  function lookupExact(original, lang, pageLanguage) {
    if (ignored.has(P.normalize(original))) return { kind: "skip" };
    const { masked, values } = P.protect(original, regex);
    // Rien à traduire : uniquement des valeurs, des chiffres ou de la ponctuation.
    if (!/\p{L}/u.test(masked.replace(/\[M\d+\]/g, ""))) return { kind: "skip" };

    const key = P.normalize(masked);
    const sourceLanguage = detectTextLanguage(original);
    if (sourceLanguage === lang || (!sourceLanguage && pageLanguage === lang)) {
      return { kind: "same", language: sourceLanguage || pageLanguage };
    }

    const entry = index.get(key);
    if (!entry) return { kind: "unknown" };

    const target = entry[lang];
    if (!target || !target.trim()) return { kind: "pending", entry };
    // Seules les traductions Eton explicitement validées peuvent sortir comme valides.
    if (lang === "local" && entry.statut !== "valide") return { kind: "pending", entry };
    if (P.normalize(target) === key) return { kind: "same", language: lang, entry };

    const integrity = validateIntegrity(original, target, values);
    if (!integrity.ok) return { kind: "integrity", entry, reason: integrity.reason };
    return { kind: "ok", text: integrity.text, values, entry };
  }

  // API structurée du moteur Eton. context.target/lang accepte "local" ou "eton".
  // Si la phrase échoue, un second essai protège les noms propres inconnus
  // (« envoyés à Paul Atangana ») pour qu'un gabarit puisse s'appliquer.
  function translate(original, context) {
    const first = translateCore(original, context);
    if (first.eton !== null || first.marqueurs_ok === false || !namesRegexFor(String(original == null ? "" : original))) return first;
    const second = withNames(String(original), () => translateCore(original, context));
    return second.eton !== null ? second : first;
  }

  function translateCore(original, context) {
    original = String(original == null ? "" : original);
    context = context && typeof context === "object" ? context : {};
    const requested = String(context.target || context.lang || context.language || "local").toLowerCase();
    if (requested !== "local" && requested !== "eton" && requested !== "eto") {
      return {
        original, eton: null, statut: "non_traduit", source: "aucune", score: 0,
        marqueurs_ok: true, raisons: ["Cette fonction ne traite que la sortie Eton."],
      };
    }

    const exact = lookupExact(original, "local", context.pageLanguage || null);
    if (exact.kind === "ok") {
      const answer = {
        original, eton: exact.text, statut: "valide", source: "exact", score: 1,
        marqueurs_ok: true, raisons: ["Correspondance exacte avec une entrée Eton validée."],
      };
      trace("exact", "valide", true);
      return answer;
    }
    if (exact.kind === "integrity") {
      trace("exact", "non_traduit", false);
      return nonTranslated(original, exact.reason || "Échec du contrôle d’intégrité.", false);
    }
    if (exact.kind === "skip" || exact.kind === "same") {
      trace("exact", exact.kind, false);
      return nonTranslated(original, exact.kind === "skip"
        ? "Aucun texte traduisible reconnu."
        : "Le texte ne nécessite pas de conversion vers l’éton.");
    }

    if (!cascade.ready) {
      trace("cascade", "indisponible", false);
      return nonTranslated(original, "Les couches de traduction ne sont pas initialisées; le texte français est conservé.");
    }

    const critical = containsCritical(original);
    const protectedSource = P.protect(original, regex);
    const matchingTemplate = NS.templates.match(protectedSource.masked, cascade.templates);
    if (matchingTemplate && (!critical || cascade.templates.some((template) =>
      template.id === matchingTemplate.id && template.critique === true
    ))) {
      const accepted = acceptCandidate(original, matchingTemplate, true);
      if (accepted.rejected || accepted.result.eton !== null) return accepted.result;
    }
    trace("template", matchingTemplate ? "critique_non_autorisée" : "sans_match", false);
    if (critical) {
      trace("cascade", "critique_sans_exact_ni_template_valide", false);
      return nonTranslated(original, "Phrase critique inconnue : seules les correspondances exactes et les gabarits critiques validés sont autorisés.");
    }

    const layers = [
      ["fuzzy", () => NS.fuzzy.match(original, context.fuzzyOptions)],
      ["segments", () => NS.segments.match(original, context.segmentOptions)],
      ["regles", () => NS.rules.match(original)],
    ];
    for (const [name, run] of layers) {
      const candidate = run();
      if (candidate && candidate.marqueurs_ok === false) {
        trace(name, "intégrité_refusée", false);
        return nonTranslated(original, candidate.raisons && candidate.raisons[0] || "Échec du contrôle d’intégrité.", false);
      }
      if (!candidate || candidate.statut === "non_traduit" || typeof candidate.eton !== "string") {
        trace(name, "sans_match", false);
        continue;
      }
      const accepted = acceptCandidate(original, candidate, false);
      if (accepted.rejected) return accepted.result;
      return accepted.result;
    }

    trace("aucune", "non_traduit", false);
    return nonTranslated(original, "Aucune couche validée ne peut traduire cette phrase sans risque.");
  }

  function setDebugTrace(enabled) {
    debugTraceEnabled = enabled === true;
    return debugTraceEnabled;
  }

  // Adaptateur conservé pour content.js et les tests historiques.
  function analyse(original, lang, pageLanguage) {
    return lookupExact(original, lang, pageLanguage);
  }

  NS.translate = {
    init, translate, analyse, validateIntegrity, normalizeForComparison, setDebugTrace,
    detectPageLanguage, detectTextLanguage, normalizeLanguageTag, guessLanguage, protectText, withNames,
  };
})();
