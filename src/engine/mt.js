/* Traduction locale de dernier recours pour le contenu inédit (français <-> anglais).
   Utilise l'API Translator intégrée à Chrome : le modèle s'exécute sur l'appareil,
   aucun texte n'est envoyé à un service externe.

   Garde-fous, dans l'ordre :
   1. les valeurs sensibles (montants, numéros, références, dates, noms connus) sont
      remplacées par des marqueurs [M1], [M2]... AVANT la traduction ;
   2. la sortie est refusée si les marqueurs, les chiffres ou les valeurs changent ;
   3. la sortie est refusée si la polarité change : négation, échec/refus, alerte.
   Un refus laisse le texte d'origine affiché : mieux vaut ne pas traduire que tromper. */
(function () {
  "use strict";
  const NS = (globalThis.ALPHA = globalThis.ALPHA || {});

  const MAX_CACHE = 3000;
  const cache = new Map(); // "fr>en|texte" -> texte traduit, ou null si refusé
  const pending = new Set();
  const translators = new Map(); // "fr>en" -> Translator | null (indisponible)
  const creating = new Map(); // "fr>en" -> Promise
  const waitingForClick = new Set(); // paires dont le modèle doit être téléchargé après un clic
  let onResult = null;
  let onStatus = null;
  let status = "idle"; // idle | unsupported | needs-activation | downloading | ready | unavailable

  function api() {
    return typeof globalThis.Translator === "function" || typeof globalThis.Translator === "object"
      ? globalThis.Translator
      : null;
  }

  function setStatus(next) {
    if (status === next) return;
    status = next;
    if (onStatus) onStatus(next);
  }

  /* ---------- Contrôles de polarité ---------- */

  const LEXICON = {
    negation: {
      fr: /(?:^|[^\p{L}])(?:ne|pas|jamais|aucune?s?|rien|sans|ni|non|impossible|personne)(?=$|[^\p{L}])|(?:^|[^\p{L}])n['’]\p{L}/iu,
      en: /(?:^|[^\p{L}])(?:not|no|never|none|nothing|without|nor|cannot|unable|impossible|nobody)(?=$|[^\p{L}])|n['’]t(?=$|[^\p{L}])/iu,
    },
    failure: {
      fr: /(?:^|[^\p{L}])(?:échou\p{L}*|échec\p{L}*|refus\p{L}*|annul\p{L}*|insuffisant\p{L}*|bloqu\p{L}*|expir\p{L}*|erreur\p{L}*|invalide\p{L}*|rejet\p{L}*|suspendu\p{L}*|impossible)(?=$|[^\p{L}])/iu,
      en: /(?:^|[^\p{L}])(?:fail\p{L}*|declin\p{L}*|reject\p{L}*|refus\p{L}*|cancel\p{L}*|insufficient|block\p{L}*|expir\p{L}*|error\p{L}*|invalid\p{L}*|suspend\p{L}*|unsuccessful|unable|cannot|impossible)(?=$|[^\p{L}])/iu,
    },
    alert: {
      fr: /(?:^|[^\p{L}])(?:alerte\p{L}*|attention|avertissement\p{L}*|sécurité|fraude\p{L}*|suspect\p{L}*|danger\p{L}*)(?=$|[^\p{L}])/iu,
      en: /(?:^|[^\p{L}])(?:alert\p{L}*|warning\p{L}*|caution|attention|security|secure|fraud\p{L}*|suspicious|danger\p{L}*)(?=$|[^\p{L}])/iu,
    },
  };

  function polarityOk(source, target, src, tgt) {
    for (const key of Object.keys(LEXICON)) {
      const a = LEXICON[key][src];
      const b = LEXICON[key][tgt];
      if (!a || !b) continue;
      if (a.test(source) !== b.test(target)) return false;
    }
    return true;
  }

  /* ---------- Traducteurs ---------- */

  // Sans geste de l'utilisateur : n'ouvre un traducteur que si le modèle est déjà sur l'appareil.
  async function ensure(src, tgt) {
    const key = src + ">" + tgt;
    if (translators.has(key)) return translators.get(key);
    if (creating.has(key)) return creating.get(key);
    const T = api();
    if (!T) {
      setStatus("unsupported");
      return null;
    }
    const job = (async () => {
      let availability = "unavailable";
      try {
        availability = await T.availability({ sourceLanguage: src, targetLanguage: tgt });
      } catch (e) {
        availability = "unavailable";
      }
      if (availability === "unavailable") {
        translators.set(key, null);
        setStatus("unavailable");
        return null;
      }
      if (availability !== "available") {
        waitingForClick.add(key);
        setStatus("needs-activation");
        return undefined; // à préparer lors du prochain clic de l'utilisateur
      }
      return open(T, src, tgt);
    })();
    creating.set(key, job);
    try {
      return await job;
    } finally {
      if (creating.get(key) === job) creating.delete(key);
    }
  }

  async function open(T, src, tgt) {
    const key = src + ">" + tgt;
    try {
      const translator = await T.create({
        sourceLanguage: src,
        targetLanguage: tgt,
        monitor(m) {
          m.addEventListener("downloadprogress", (e) => {
            setStatus(e.loaded >= 1 ? "ready" : "downloading");
          });
        },
      });
      translators.set(key, translator);
      setStatus("ready");
      return translator;
    } catch (e) {
      waitingForClick.add(key);
      setStatus("needs-activation");
      return undefined;
    }
  }

  // À appeler pendant un clic : Chrome n'autorise le téléchargement d'un modèle
  // qu'à la suite d'un geste de l'utilisateur.
  function prepare(pairs) {
    const T = api();
    if (!T) {
      setStatus("unsupported");
      return;
    }
    for (const [src, tgt] of pairs) {
      const key = src + ">" + tgt;
      if (translators.get(key)) continue;
      waitingForClick.delete(key);
      const job = open(T, src, tgt).then((t) => {
        if (t && onResult) onResult();
        return t;
      });
      creating.set(key, job);
      job.finally(() => { if (creating.get(key) === job) creating.delete(key); });
    }
  }

  /* ---------- Traduction ---------- */

  function remember(key, value) {
    if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
    cache.set(key, value);
  }

  // Renvoie la traduction déjà prête, null si refusée, undefined si en cours ou impossible.
  function lookup(text, src, tgt) {
    if (!src || !tgt || src === tgt) return undefined;
    const key = src + ">" + tgt + "|" + text;
    if (cache.has(key)) return cache.get(key);
    const pair = src + ">" + tgt;
    if (translators.get(pair) === null || waitingForClick.has(pair)) return undefined;
    if (!pending.has(key) && api()) {
      pending.add(key);
      run(text, src, tgt, key).finally(() => pending.delete(key));
    }
    return undefined;
  }

  async function run(text, src, tgt, key) {
    const translator = await ensure(src, tgt);
    if (!translator) return; // pas de modèle : le texte reste tel quel, sans mise en cache
    const T = NS.translate;
    const { masked, values } = T.protectText(text);
    let output;
    try {
      output = await translator.translate(masked);
    } catch (e) {
      remember(key, null);
      return;
    }
    remember(key, check(text, masked, values, output, src, tgt));
    if (onResult) onResult();
  }

  // Applique tous les garde-fous et renvoie le texte final, ou null.
  function check(original, masked, values, output, src, tgt) {
    if (typeof output !== "string" || !output.trim()) return null;
    // Les modèles ajoutent parfois des espaces dans les marqueurs : [ M1 ] -> [M1].
    const candidate = output.replace(/\[\s*M\s*(\d+)\s*\]/gi, "[M$1]").trim();
    // Même protection que protectText (noms propres inconnus compris).
    const integrity = NS.translate.withNames(original, () =>
      NS.translate.validateIntegrity(original, candidate, values));
    if (!integrity.ok) return null;
    const result = integrity.text;
    const plainSource = masked.replace(/\[M\d+\]/g, " ");
    const plainTarget = candidate.replace(/\[M\d+\]/g, " ");
    if (!polarityOk(plainSource, plainTarget, src, tgt)) return null;
    const ratio = plainTarget.length / Math.max(1, plainSource.length);
    if (ratio < 0.3 || ratio > 3.5) return null;
    if (NS.protect.normalize(result) === NS.protect.normalize(original)) return null;
    return result;
  }

  NS.mt = {
    supported: () => Boolean(api()),
    status: () => status,
    lookup,
    prepare,
    ensure,
    polarityOk,
    check,
    onResult(cb) { onResult = cb; },
    onStatus(cb) { onStatus = cb; },
  };
})();
