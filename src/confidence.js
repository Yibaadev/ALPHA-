/* Utilitaires de présentation et normalisation textuelle ALPHA. */
(function () {
  "use strict";

  const NS = (globalThis.ALPHA = globalThis.ALPHA || {});
  const STATUS = {
    traduit: {
      id: "traduit",
      label: "Traduit",
      badge: "",
      description: "Texte en langue locale.",
    },
    non_traduit: {
      id: "non_traduit",
      label: "Texte original",
      badge: "",
      description: "Texte conservé dans sa langue d'origine.",
    },
    // Rétrocompatibilité interne neutre
    valide: { id: "traduit", label: "Traduit", badge: "", description: "" },
    probable: { id: "traduit", label: "Traduit", badge: "", description: "" },
    automatique: { id: "traduit", label: "Traduit", badge: "", description: "" },
  };

  function normalize(value) {
    return String(value == null ? "" : value)
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[‘’ʼ`]/g, "'")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function containsAnyTerm(text, terms) {
    const normalized = normalize(text);
    for (const termValue of Array.isArray(terms) ? terms : []) {
      const term = normalize(termValue);
      if (!term) continue;
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
      if (new RegExp("(?:^|\\s)" + escaped + "(?=$|\\s)").test(normalized)) return true;
    }
    return false;
  }

  function present(result, original) {
    original = String(original == null ? "" : original);
    const hasTranslation = result && typeof result.eton === "string" && result.eton.length > 0 && result.marqueurs_ok !== false;
    const translation = hasTranslation ? result.eton : null;
    const statusKey = translation ? "traduit" : "non_traduit";
    return {
      status: statusKey,
      meta: STATUS[statusKey] || STATUS.traduit,
      translation,
      visibleText: translation === null ? original : translation,
      originalText: null,
      showWarning: false,
      originalVisible: false,
    };
  }

  function speechText(display) {
    if (!display || typeof display.visibleText !== "string") return "";
    return display.visibleText;
  }

  NS.confidence = {
    statuses: STATUS,
    normalize,
    containsAnyTerm,
    present,
    speechText,
  };
})();
