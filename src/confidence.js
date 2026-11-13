/* Présentation commune des quatre niveaux de confiance SAFINUM. */
(function () {
  "use strict";

  const NS = (globalThis.SAFINUM = globalThis.SAFINUM || {});
  const STATUS = {
    valide: {
      id: "valide",
      label: "Valide",
      badge: "Valide",
      description: "Traduction vérifiée par une personne.",
    },
    probable: {
      id: "probable",
      label: "Probable",
      badge: "Probable",
      description: "Traduction non vérifiée; texte français affiché.",
    },
    automatique: {
      id: "automatique",
      label: "Automatique",
      badge: "Automatique",
      description: "Traduction non vérifiée; texte français affiché.",
    },
    non_traduit: {
      id: "non_traduit",
      label: "Non traduit",
      badge: "Non traduit",
      description: "Texte original conservé.",
    },
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

  function present(result, original, keepOriginal) {
    original = String(original == null ? "" : original);
    const requested = result && result.statut;
    const status = STATUS[requested] && requested !== "non_traduit" &&
      typeof result.eton === "string" && result.eton.length > 0 && result.marqueurs_ok !== false
      ? requested
      : "non_traduit";
    const translation = status === "non_traduit" ? null : result.eton;
    return {
      status,
      meta: STATUS[status],
      translation,
      visibleText: translation === null ? original : translation,
      originalText: status !== "non_traduit" && (status !== "valide" || Boolean(keepOriginal)) ? original : null,
      showWarning: status === "probable" || status === "automatique",
      originalVisible: status !== "valide" || Boolean(keepOriginal),
    };
  }

  function speechText(display) {
    if (!display || !STATUS[display.status]) return "Texte original conservé.";
    if (display.status === "valide") {
      const original = display.originalText ? " Message français original : " + display.originalText + "." : "";
      return "Traduction éton vérifiée : " + display.translation + "." + original;
    }
    if (display.status === "probable") {
      return "Traduction éton probable, non vérifiée. Texte français original : " + display.originalText +
        ". Proposition en éton : " + display.translation + ". Vérifiez les montants.";
    }
    if (display.status === "automatique") {
      return "Traduction éton automatique, non vérifiée. Texte français original : " + display.originalText +
        ". Proposition en éton : " + display.translation + ". Vérifiez les montants.";
    }
    return "Texte non traduit. Texte français original : " + display.visibleText + ".";
  }

  NS.confidence = {
    statuses: STATUS,
    normalize,
    containsAnyTerm,
    present,
    speechText,
  };
})();
