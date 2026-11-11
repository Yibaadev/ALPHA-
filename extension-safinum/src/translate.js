/* Recherche d'un texte dans le dictionnaire.
   Le texte de la page (français ou anglais) est comparé aux colonnes "fr" et "en".
   On renvoie la version demandée, seulement si le contrôle des valeurs est passé. */
(function () {
  "use strict";
  const NS = globalThis.SAFINUM;
  const P = NS.protect;

  let index = new Map();
  let regex = P.build([]);
  let ignored = new Set();

  function init(dict) {
    const meta = dict.meta || {};
    regex = P.build(meta.names || []);
    ignored = new Set((meta.ignore || []).map(P.normalize));
    index = new Map();
    for (const e of dict.entries) {
      if (e.fr) index.set(P.normalize(e.fr), e);
      if (e.en && e.en.trim()) index.set(P.normalize(e.en), e);
    }
  }

  // lang : "fr", "en" ou "local"
  // Résultat : { kind: "skip" | "unknown" | "pending" | "integrity" | "ok", text?, values?, entry? }
  function analyse(original, lang) {
    if (ignored.has(P.normalize(original))) return { kind: "skip" };
    const { masked, values } = P.protect(original, regex);
    // Rien à traduire : uniquement des valeurs, des chiffres ou de la ponctuation.
    if (!/\p{L}/u.test(masked.replace(/\[M\d+\]/g, ""))) return { kind: "skip" };

    const entry = index.get(P.normalize(masked));
    if (!entry) return { kind: "unknown" };

    const target = entry[lang];
    if (!target || !target.trim()) return { kind: "pending", entry };

    const text = P.restore(target, values);
    if (text === null) return { kind: "integrity", entry };
    return { kind: "ok", text, values, entry };
  }

  NS.translate = { init, analyse };
})();
