/* Prépare un contexte minimal pour l’aide IA. Aucun formulaire ni texte de page
   complet n’est envoyé : seuls des repères visibles et explicitement autorisés. */
(function () {
  "use strict";

  const NS = (globalThis.ALPHA = globalThis.ALPHA || {});
  const MAX_SELECTION_LENGTH = 1200;
  const MAX_ITEM_LENGTH = 220;
  const MAX_ITEMS = 8;
  const SENSITIVE_PATTERNS = [
    { pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, replacement: "[courriel masqué]" },
    { pattern: /\b(?:SAF|REF|TXN)[-\s]?[A-Z0-9-]{5,}\b/gi, replacement: "[référence masquée]" },
    { pattern: /\b\d[\d\s.,]*\s?(?:FCFA|XAF|CFA|EUR|USD|€|\$)\b/gi, replacement: "[montant masqué]" },
    { pattern: /\b(?:montant|solde|total|frais|référence|reference)\s*[:：]?\s*\d[\d\s.,-]*/gi, replacement: "[valeur financière masquée]" },
    { pattern: /\b(?:\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/g, replacement: "[date masquée]" },
    { pattern: /\+?\d(?:[\d\s().-]{6,}\d)/g, replacement: "[numéro masqué]" },
    { pattern: /\b(?:\d[ -]?){8,}\d\b/g, replacement: "[identifiant masqué]" },
    { pattern: /\b(?:bonjour|bonsoir|hello|hi)\s*[,!:-]?\s+[\p{Lu}][\p{L}'’-]+(?:\s+[\p{Lu}][\p{L}'’-]+){0,2}/giu, replacement: "Bonjour" },
  ];

  function plainText(value, limit = MAX_ITEM_LENGTH) {
    return String(value || "")
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, limit);
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function privateFieldValues(doc) {
    const values = [];
    for (const field of doc.querySelectorAll("input, textarea, select")) {
      const value = String(field.value || "").trim();
      if (value.length >= 2) values.push(value);
      if (values.length >= 100) break;
    }
    return values.sort((a, b) => b.length - a.length).slice(0, 100);
  }

  function sanitizeText(value, privateValues) {
    let text = plainText(value, 500);
    for (const valueToHide of privateValues) {
      if (valueToHide.length < 2) continue;
      text = text.replace(new RegExp(escapeRegExp(valueToHide), "gi"), "[valeur masquée]");
    }
    for (const item of SENSITIVE_PATTERNS) text = text.replace(item.pattern, item.replacement);
    return plainText(text);
  }

  function isVisible(element) {
    if (!element || !element.isConnected || element.closest("[hidden], [aria-hidden='true']")) return false;
    if (element.getClientRects().length === 0) return false;
    const style = element.ownerDocument.defaultView.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
  }

  function textOf(element, privateValues) {
    if (!isVisible(element)) return "";
    const visibleText = plainText(element.innerText || element.textContent || "", 500);
    const value = visibleText || element.getAttribute("aria-label") || element.getAttribute("title") || "";
    return sanitizeText(value, privateValues);
  }

  function unique(items, limit = MAX_ITEMS) {
    return [...new Set(items.map((item) => plainText(item)).filter(Boolean))].slice(0, limit);
  }

  function insideExtension(element, hostId) {
    return Boolean(element && (element.id === hostId || element.closest(`#${hostId}`)));
  }

  function selectionForExplanation(value, doc, hostId) {
    const rawSelection = String(value || "").trim();
    if (rawSelection.length > MAX_SELECTION_LENGTH) {
      return { ok: false, error: "La sélection est trop longue. Sélectionnez un extrait de 1 200 caractères maximum." };
    }
    const selection = plainText(rawSelection, MAX_SELECTION_LENGTH);
    if (selection.length < 3) {
      return { ok: false, error: "Sélectionnez une phrase ou un terme à expliquer." };
    }

    const active = doc.activeElement;
    if (active && (active.matches("input, textarea, select") || active.isContentEditable)) {
      return { ok: false, error: "Pour protéger votre saisie, sélectionnez le texte de la page, hors des champs de formulaire." };
    }
    if (insideExtension(active, hostId)) {
      return { ok: false, error: "Sélectionnez d’abord le texte de la page." };
    }

    const safe = sanitizeText(selection, privateFieldValues(doc));
    if (!safe || safe.length < 3) {
      return { ok: false, error: "Cette sélection contient des données qui ne peuvent pas être masquées sûrement." };
    }
    if (/\[(?:montant|numéro|identifiant|référence|courriel) masqué\]/i.test(safe)) {
      return { ok: false, error: "La sélection contient une donnée personnelle ou financière. Sélectionnez seulement le libellé à expliquer." };
    }
    return { ok: true, text: safe };
  }

  function buildPageContext(doc, hostId) {
    const privateValues = privateFieldValues(doc);
    const candidates = (selector, limit = MAX_ITEMS) => {
      const result = [];
      for (const element of doc.querySelectorAll(selector)) {
        if (insideExtension(element, hostId)) continue;
        const text = textOf(element, privateValues);
        if (text) result.push(text);
        if (result.length >= limit) break;
      }
      return result;
    };

    const headings = candidates("h1, h2, h3", 6).filter((text) => !/^bonjour\b/i.test(text));
    const activeStep = candidates(
      '[aria-current="step"], [aria-current="page"], [aria-selected="true"], [data-state="active"]',
      3,
    );
    const alerts = candidates('[role="alert"], [role="status"], [aria-live="assertive"]', 4);
    const actions = [];
    for (const element of doc.querySelectorAll('button, a[role="button"], [role="button"]')) {
      if (insideExtension(element, hostId) || element.disabled || element.getAttribute("aria-disabled") === "true") continue;
      const text = textOf(element, privateValues);
      if (text) actions.push(text);
      if (actions.length >= 8) break;
    }
    const fieldLabels = candidates("label", 8);
    const pageTitle = sanitizeText(doc.title, privateValues);

    const context = {
      pageTitle,
      activeStep: unique(activeStep, 3),
      headings: unique(headings, 6),
      alerts: unique(alerts, 4),
      fieldLabels: unique(fieldLabels, 8),
      actions: unique(actions, 8),
    };
    const size = JSON.stringify(context).length;
    if (size > 6000) {
      context.headings = context.headings.slice(0, 4);
      context.alerts = context.alerts.slice(0, 2);
      context.fieldLabels = context.fieldLabels.slice(0, 5);
      context.actions = context.actions.slice(0, 5);
    }
    return context;
  }

  NS.assistantContext = { buildPageContext, selectionForExplanation };
})();
