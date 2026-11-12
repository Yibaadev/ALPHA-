/* Protection des valeurs sensibles.
   Les montants, numéros, références, dates et noms sont mis de côté avant la traduction,
   puis remis tels quels. Un montant ne passe donc jamais par une traduction. */
(function () {
  "use strict";
  const NS = (globalThis.ALPHA = globalThis.ALPHA || {});

  const SP = "[\\s\\u00a0\\u202f]";
  const withCapital = (list) =>
    list.map((m) => "[" + m[0].toUpperCase() + m[0] + "]" + m.slice(1)).join("|");
  const MOIS_FR = withCapital(["janv", "févr", "fév", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"]);
  const MOIS_EN = withCapital(["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]);

  // L'ordre compte : à la même position, le premier motif qui correspond l'emporte.
  const PATTERNS = [
    // montants : 25 000 FCFA, -12 500 FCFA, +180 000 FCFA
    "[-\\u2212+]?\\d[\\d\\s\\u00a0\\u202f.,]*\\d?" + SP + "?(?:FCFA|F CFA|XAF)",
    // téléphone : +237 6 99 12 34 56
    "\\+\\d{1,3}(?:" + SP + "?[.-]?\\d){8,12}",
    // numéro de compte : CM 001 2345 6789 01
    "\\b[A-Z]{2}" + SP + "?\\d{3}(?:" + SP + "?\\d{4}){2}" + SP + "?\\d{2}\\b",
    // référence : SAF-2026-TRI1LW
    "\\b[A-Z]{2,6}-\\d{4}-[A-Z0-9]{3,}\\b",
    // code technique : SECURITY_001
    "\\b[A-Z]{3,}_\\d{2,}\\b",
    // dates : 05 nov. 2026 / Nov 5, 2026 / 05/11/2026
    "\\b\\d{1,2}" + SP + "(?:" + MOIS_FR + ")\\.?" + SP + "\\d{4}\\b",
    "\\b(?:" + MOIS_EN + ")[a-z]*\\.?" + SP + "\\d{1,2},?" + SP + "\\d{4}\\b",
    "\\b\\d{1,2}[/.-]\\d{1,2}[/.-]\\d{2,4}\\b",
    // devise seule
    "\\b(?:FCFA|XAF)\\b",
  ];

  function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // Construit l'expression qui repère les valeurs à protéger (+ la liste de noms connus).
  function build(names) {
    const parts = [];
    const list = (names || [])
      .filter(Boolean)
      .slice()
      .sort((a, b) => b.length - a.length)
      .map(escapeRe);
    if (list.length) parts.push("(?<![\\wÀ-ÿ])(?:" + list.join("|") + ")(?![\\wÀ-ÿ])");
    PATTERNS.forEach((p) => parts.push(p));
    return new RegExp(parts.map((p) => "(?:" + p + ")").join("|"), "gi");
  }

  // "Total : 25 000 FCFA" devient { masked: "Total : [M1]", values: ["25 000 FCFA"] }
  function protect(text, re) {
    const values = [];
    re.lastIndex = 0;
    const masked = text.replace(re, (m) => {
      values.push(m);
      return "[M" + values.length + "]";
    });
    return { masked, values };
  }

  // Remet les valeurs à la place des marqueurs. Renvoie null si les marqueurs ne correspondent
  // pas exactement aux valeurs (un marqueur manquant, en trop, ou répété).
  function restore(template, values) {
    const seen = new Set();
    let ok = true;
    const out = template.replace(/\[M(\d+)\]/g, (m, n) => {
      const i = Number(n) - 1;
      if (i < 0 || i >= values.length || seen.has(i)) {
        ok = false;
        return m;
      }
      seen.add(i);
      return values[i];
    });
    if (!ok || seen.size !== values.length) return null;
    return out;
  }

  // Forme comparable : sans différence d'espaces, de majuscules ou d'apostrophes.
  function normalize(s) {
    return s
      .normalize("NFC")
      .replace(/[‘’ʼ]/g, "'")
      .replace(/[\s  ]+/g, " ")
      .trim()
      .toLowerCase();
  }

  NS.protect = { build, protect, restore, normalize };
})();
