/* Relie le guide « ? » (src/guide.js) à la page et au panneau :
   relevé de la page avec ses textes d'origine, rafraîchissement, lecture, bulle de présentation.
   Rien n'est stocké ni transmis : seul le fait d'avoir vu la bulle est mémorisé. */
(function () {
  "use strict";

  const NS = (globalThis.ALPHA = globalThis.ALPHA || {});
  const INTRO_KEY = "alphaIntroSeen";

  /* textState / attrState : états tenus par content.js (texte d'origine et texte écrit). */
  function create({ hostId, textState, attrState, getPanel, getMode, getPageLanguage, voice }) {
    // Texte d'origine d'un élément, même si ALPHA l'a traduit à l'écran.
    function originalTextOf(el) {
      let out = "";
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const st = textState.get(node);
        out += st && st.orig !== undefined && st.written === node.nodeValue ? st.orig : node.nodeValue;
      }
      return out;
    }
    function originalAttrOf(el, name) {
      const map = attrState.get(el);
      const st = map && map[name];
      const current = el.getAttribute(name);
      return st && st.orig !== undefined && st.written === current ? st.orig : current;
    }
    const ownElements = "#" + hostId + ", .alpha-status-badge, .alpha-status-original, .alpha-status-warning";
    const helpers = {
      origText: originalTextOf,
      origAttr: originalAttrOf,
      skip: (el) => Boolean(el.closest(ownElements)),
    };

    let current = null;
    function refresh() {
      const panel = getPanel();
      if (!panel || !NS.guide) return;
      try {
        current = NS.guide.build(NS.guide.snapshot(document, helpers), getMode(), getPageLanguage());
        panel.setGuide(current);
        if (NS.explain && panel.setExplainHint) panel.setExplainHint(NS.explain.ui(current.lang).hint);
        panel.setIntroTexts(NS.guide.intro(getMode(), getPageLanguage()));
      } catch (e) {
        console.warn("[ALPHA] guide indisponible :", e);
      }
    }

    // Après chaque passage de traduction, si le guide est affiché (regroupé).
    let timer = null;
    function schedule() {
      const panel = getPanel();
      if (timer || !panel || !panel.guideVisible()) return;
      timer = setTimeout(() => {
        timer = null;
        refresh();
      }, 250);
    }

    function speak() {
      refresh();
      voice.speakGuide(current ? current.speech : "", current ? current.lang : "fr");
    }

    // Bulle « Moi, c'est ALPHA » : une seule fois, à la première visite.
    async function start() {
      const panel = getPanel();
      if (!panel || !NS.guide) return;
      panel.setIntroTexts(NS.guide.intro(getMode(), getPageLanguage()));
      let seen = false;
      try {
        const r = await chrome.storage.local.get(INTRO_KEY);
        seen = Boolean(r && r[INTRO_KEY]);
      } catch (e) {
        seen = false;
      }
      if (seen) return;
      setTimeout(() => {
        panel.showIntro(NS.guide.intro(getMode(), getPageLanguage()), () => {
          try {
            chrome.storage.local.set({ [INTRO_KEY]: true });
          } catch (e) {
            /* sans importance : la bulle reviendra à la prochaine visite */
          }
        });
      }, 1200); // après l'entrée animée de la carte
    }

    return { refresh, schedule, speak, start };
  }

  NS.guideController = { create };
})();
