/* Voix éton préenregistrées : clips audio livrés avec l'extension (data/audio/eton/).
   Aucun modèle ne tourne ici : ce sont des fichiers, produits à l'avance (OmniVoice, voix
   provisoire) ou enregistrés par un locuteur (prioritaires). Rien n'est transmis.
   Lecture par la Web Audio API, que la politique de sécurité (CSP) des sites ne bloque pas. */
(function () {
  "use strict";

  const NS = (globalThis.ALPHA = globalThis.ALPHA || {});
  const MAX_NODES = 400;
  const SKIP = "script, style, noscript, template, textarea, input, select, code, pre, [aria-hidden='true'], " +
    ".alpha-status-badge, .alpha-status-original, .alpha-status-warning";

  // Forme de comparaison d'un texte éton : tons et diacritiques conservés, espaces normalisés.
  const norm = (text) => String(text || "").normalize("NFC").replace(/[\s  ]+/g, " ").trim();

  // Mots d'un texte (lettres et diacritiques, apostrophes internes) : la ponctuation ne compte pas.
  const WORD = /[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*/gu;
  const wordsOf = (text) => norm(text).toLowerCase().replace(/'/g, "’").match(WORD) || [];

  function create({ hostId }) {
    let clips = new Map(); // texte éton -> { file, source, revue }
    let phrases = new Map(); // suite de mots -> clip (pour découper une phrase assemblée)
    let maxWords = 1;
    let meta = {};
    let context = null;
    let current = null; // source audio en cours
    const buffers = new Map();

    async function load() {
      try {
        const response = await fetch(chrome.runtime.getURL("data/audio/eton/index.json"));
        if (!response.ok) return;
        const index = await response.json();
        meta = index.meta || {};
        clips = new Map((index.clips || []).map((clip) => [norm(clip.text), clip]));
        phrases = new Map();
        maxWords = 1;
        for (const clip of index.clips || []) {
          const words = wordsOf(clip.text);
          if (!words.length) continue;
          const key = words.join(" ");
          if (!phrases.has(key)) phrases.set(key, clip);
          maxWords = Math.max(maxWords, words.length);
        }
      } catch (e) {
        clips = new Map(); // pas de clips : rien n'est lu en éton (et jamais en français)
        phrases = new Map();
      }
    }

    function clipFor(text) {
      return clips.get(norm(text)) || null;
    }

    /* Clips d'un texte éton : le clip de la phrase entière s'il existe ; sinon la phrase est découpée
       en morceaux enregistrés, du plus long au plus court (« Mwàní àlígì á kɔ̂nt : 25 000 FCFA » ->
       clip « Mwàní àlígì á kɔ̂nt : »). Les mots restants (montant, nom, mot non traduit) ne sont pas lus. */
    function textQueue(text) {
      const whole = clipFor(text);
      if (whole) return { items: [{ clip: whole }], missing: 0 };
      const words = wordsOf(text);
      const items = [];
      let missing = 0;
      let gap = false;
      for (let i = 0; i < words.length;) {
        let found = null;
        for (let len = Math.min(maxWords, words.length - i); len > 0 && !found; len--) {
          const clip = phrases.get(words.slice(i, i + len).join(" "));
          if (clip) found = { clip, len };
        }
        if (found) {
          items.push({ clip: found.clip });
          i += found.len;
          gap = false;
        } else {
          if (!gap) missing++;
          gap = true;
          i++;
        }
      }
      if (!words.length && /\p{N}/u.test(text)) missing++;
      return { items, missing };
    }

    function describe() {
      const list = [...clips.values()];
      return {
        count: list.length,
        speaker: list.some((clip) => clip.source === "locuteur"),
        synthetic: list.some((clip) => clip.source === "omnivoice"),
        unreviewed: list.some((clip) => clip.revue !== "oui"),
      };
    }

    function visible(el) {
      if (!el || el.closest(SKIP) || el.closest("#" + hostId)) return false;
      if (typeof el.checkVisibility === "function") return el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
      for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
        if (node.hidden) return false;
        const style = getComputedStyle(node);
        if (style.display === "none" || style.visibility === "hidden") return false;
      }
      return true;
    }

    // Textes à lire pour un élément : ses nœuds de texte visibles ; pour un champ, son libellé.
    function textsOf(el) {
      if (el.matches("input, select, textarea")) {
        const label = el.labels && el.labels[0];
        if (label) return textsOf(label);
        const value = el.matches("input[type=button], input[type=submit]") ? el.value : "";
        return [value || el.getAttribute("aria-label") || el.getAttribute("placeholder") || ""].map(norm).filter(Boolean);
      }
      const out = [];
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      while (walker.nextNode() && out.length < MAX_NODES) {
        const node = walker.currentNode;
        const text = norm(node.nodeValue);
        if (text && visible(node.parentElement)) out.push(text);
      }
      return out;
    }

    /* Clips éton d'un élément, dans l'ordre. En éton, ALPHA ne lit QUE des voix éton :
       un passage sans clip (montant, nom, texte pas encore enregistré) est compté, pas lu en français. */
    function elementQueue(el) {
      const items = [];
      let missing = 0;
      for (const text of textsOf(el)) {
        const part = textQueue(text);
        items.push(...part.items);
        missing += part.missing;
      }
      return { items, missing };
    }

    async function bufferFor(file) {
      if (buffers.has(file)) return buffers.get(file);
      const response = await fetch(chrome.runtime.getURL("data/audio/eton/" + file));
      if (!response.ok) throw new Error("clip introuvable : " + file);
      const buffer = await context.decodeAudioData(await response.arrayBuffer());
      if (buffers.size > 200) buffers.delete(buffers.keys().next().value);
      buffers.set(file, buffer);
      return buffer;
    }

    // Lit un clip ; la promesse se résout à la fin du clip (ou quand il est arrêté).
    async function playClip(clip) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) throw new Error("Web Audio indisponible");
      if (!context) context = new Ctx();
      if (context.state === "suspended") await context.resume();
      const buffer = await bufferFor(clip.file);
      await new Promise((resolve) => {
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(context.destination);
        source.onended = () => {
          if (current === source) current = null;
          resolve();
        };
        current = source;
        source.start();
      });
    }

    function stopClip() {
      if (!current) return;
      const source = current;
      current = null;
      try {
        source.stop();
      } catch (e) {
        /* déjà terminé */
      }
    }

    // À appeler pendant le clic « Écouter » : Chrome n'autorise le son qu'après un geste.
    function unlock() {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!context) context = new Ctx();
      if (context.state === "suspended") context.resume().catch(() => {});
    }

    return { load, clipFor, textQueue, describe, elementQueue, playClip, stopClip, unlock, meta: () => meta };
  }

  NS.etonAudio = { create };
})();
