/* Choix de traduction indépendants du parcours DOM et du panneau. */
(function () {
  "use strict";

  const NS = (globalThis.ALPHA = globalThis.ALPHA || {});

  /** Crée le contrôleur avec les moteurs fournis par l'extension. */
  function create({ translate, machine, getCriticalData }) {
    function unchanged(original) {
      return { text: original, translated: false };
    }

    function retainOuterWhitespace(original, translated) {
      if (translated === original) return original;
      const lead = original.match(/^\s*/)?.[0] || "";
      const trail = original.match(/\s*$/)?.[0] || "";
      return lead + translated + trail;
    }

    function sourceLanguageOf(text, pageLanguage) {
      return translate.guessLanguage(text) || pageLanguage;
    }

    function toEton(text, language) {
      if (!getCriticalData()) return null;
      const result = translate.translate(text, { target: "eton", pageLanguage: language });
      return result && typeof result.eton === "string" && result.eton.trim() && result.marqueurs_ok !== false
        ? result.eton
        : null;
    }

    /** Renvoie le texte à afficher et indique si une traduction a abouti. */
    function translateText(value, mode, pageLanguage) {
      const original = String(value == null ? "" : value);
      if (mode === "local") {
        if (translate.analyse(original, "local", pageLanguage).kind === "skip") return unchanged(original);
        const eton = toEton(original, pageLanguage);
        if (eton) return { text: retainOuterWhitespace(original, eton), translated: true };

        if (sourceLanguageOf(original, pageLanguage) === "en") {
          const french = machine(original, "en", "fr");
          if (french) {
            return { text: retainOuterWhitespace(original, toEton(french, "fr") || french), translated: true };
          }
        }
        return unchanged(original);
      }

      const result = translate.analyse(original, mode, pageLanguage);
      if (result.kind === "ok") {
        const candidate = retainOuterWhitespace(original, result.text);
        if (Array.isArray(result.values) && result.values.every((valueToPreserve) => candidate.includes(valueToPreserve))) {
          return { text: candidate, translated: true };
        }
      }

      if (result.kind === "unknown" || result.kind === "same") {
        const source = sourceLanguageOf(original, pageLanguage);
        if (source && source !== mode) {
          const translated = machine(original, source, mode);
          if (translated) return { text: retainOuterWhitespace(original, translated), translated: true };
        }
      }
      return unchanged(original);
    }

    return { translateText };
  }

  NS.translationController = { create };
})();
