/* Détection indépendante de la langue source et de la langue de la page. */
(function () {
  "use strict";

  const NS = (globalThis.ALPHA = globalThis.ALPHA || {});
  const P = NS.protect;
  let languageIndexes = { fr: new Map(), en: new Map() };
  let regex = P.build([]);
  let ignored = new Set();

  function init(dictionary) {
    const data = dictionary || {};
    const meta = data.meta || {};
    regex = P.build(meta.names || []);
    ignored = new Set((meta.ignore || []).map(P.normalize));
    languageIndexes = { fr: new Map(), en: new Map() };

    for (const entry of data.entries || []) {
      if (entry.fr) languageIndexes.fr.set(P.normalize(entry.fr), entry);
      for (const text of [entry.en, ...(Array.isArray(entry.en_variants) ? entry.en_variants : [])]) {
        if (typeof text !== "string" || !text.trim()) continue;
        languageIndexes.en.set(P.normalize(text), entry);
      }
    }
  }

  function normalizeLanguageTag(tag) {
    const language = String(tag || "").trim().toLowerCase().split(/[-_]/)[0];
    return language === "fr" || language === "en" ? language : null;
  }

  function detectTextLanguage(original) {
    if (ignored.has(P.normalize(original))) return null;
    const { masked } = P.protect(original, regex);
    const key = P.normalize(masked);
    const isFrench = languageIndexes.fr.has(key);
    const isEnglish = languageIndexes.en.has(key);
    if (isFrench === isEnglish) return null;
    return isFrench ? "fr" : "en";
  }

  const STOPWORDS = {
    fr: new Set(("le la les un une des du de au aux et ou est sont été être avec pour par sur dans vers votre vos " +
      "nous vous ils elle il ce cette ces qui que ne pas plus sans très mais leur leurs avez avant après " +
      "été sera seront veuillez merci aucun aucune frais solde montant compte").split(" ")),
    en: new Set(("the a an of to and or is are was were be been with for by on in into your our you we they " +
      "it this that these those which who not no more without very but their have has before after will " +
      "please thank any fee fees balance amount account").split(" ")),
  };

  function guessLanguage(text) {
    const known = detectTextLanguage(text);
    if (known) return known;
    const words = String(text || "").toLowerCase().normalize("NFC").match(/\p{L}+/gu) || [];
    if (!words.length) return null;
    let fr = 0;
    let en = 0;
    for (const word of words) {
      if (STOPWORDS.fr.has(word)) fr++;
      if (STOPWORDS.en.has(word)) en++;
    }
    if (/[àâçéèêëîïôûùüÿœæ]/i.test(text)) fr += 2;
    if (fr === en || (Math.max(fr, en) < 2 && words.length > 3)) return null;
    return fr > en ? "fr" : "en";
  }

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

  NS.language = {
    init,
    normalizeLanguageTag,
    detectTextLanguage,
    guessLanguage,
    detectPageLanguage,
  };
})();
