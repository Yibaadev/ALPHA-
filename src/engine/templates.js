/* Matching exact des gabarits français et restauration de leurs marqueurs. */
(function () {
  "use strict";

  const NS = (globalThis.SAFINUM = globalThis.SAFINUM || {});
  const MARKER_RE = /\[M(\d+)\]/g;

  function markerTokens(text) {
    return String(text).match(/\[M\d+\]/g) || [];
  }

  function markerNumbers(text) {
    return [...String(text).matchAll(MARKER_RE)].map((match) => Number(match[1]));
  }

  function sameArray(a, b) {
    return a.length === b.length && a.every((value, i) => value === b[i]);
  }

  function escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function literalPattern(text) {
    return text.split(/(\s+)/).map((part) =>
      /^\s+$/.test(part) ? "\\s+" : escapeRegex(part)
    ).join("");
  }

  function compilePattern(pattern) {
    if (typeof pattern !== "string") return null;
    const slotNumbers = markerNumbers(pattern);
    if (slotNumbers.some((number, i) => number !== i + 1)) return null;

    let source = "^";
    let cursor = 0;
    const markers = [...pattern.matchAll(MARKER_RE)];
    for (const marker of markers) {
      source += literalPattern(pattern.slice(cursor, marker.index));
      source += "(\\[M\\d+\\])";
      cursor = marker.index + marker[0].length;
    }
    source += literalPattern(pattern.slice(cursor)) + "$";
    return { regex: new RegExp(source, "iu"), slotNumbers };
  }

  function matchTemplate(maskedText, template) {
    if (!template || template.statut !== "valide" || typeof template.eton !== "string" || !template.eton.trim()) return null;
    const compiled = compilePattern(template.fr_pattern);
    if (!compiled) return null;

    const match = compiled.regex.exec(String(maskedText));
    if (!match) return null;
    const inputMarkers = markerTokens(maskedText);
    const bindings = match.slice(1);
    if (!sameArray(inputMarkers, bindings) || inputMarkers.length !== compiled.slotNumbers.length) return null;

    const targetSlots = markerNumbers(template.eton);
    if (!sameArray(targetSlots, compiled.slotNumbers)) return null;

    const bySlot = new Map(compiled.slotNumbers.map((slot, i) => [slot, bindings[i]]));
    const eton = template.eton.replace(MARKER_RE, (_, number) => bySlot.get(Number(number)) || "");
    if (!sameArray(markerTokens(eton), inputMarkers)) return null;

    return {
      id: template.id,
      eton,
      statut: "probable",
      source: "template",
      marqueurs_ok: true,
      raisons: ["Correspondance exacte avec le gabarit " + template.id + "."],
    };
  }

  function match(maskedText, templates) {
    const matches = (templates || [])
      .map((template) => matchTemplate(maskedText, template))
      .filter(Boolean);
    return matches.length === 1 ? matches[0] : null;
  }

  NS.templates = { compilePattern, matchTemplate, match, markerTokens };
})();
