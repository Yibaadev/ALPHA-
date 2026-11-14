/* Relie l'action « Expliquer » (src/explain.js) à la sélection de l'utilisateur.
   Le bouton n'apparaît que si la sélection contient un terme du glossaire : il ne gêne pas
   sur les autres sites. Jamais dans un champ de saisie ni dans le panneau ALPHA. */
(function () {
  "use strict";

  const NS = (globalThis.ALPHA = globalThis.ALPHA || {});
  const MAX_SELECTION = 600;
  const EXCLUDED = "input, textarea, select, [contenteditable=''], [contenteditable='true'], [translate='no'], .notranslate";

  function create({ hostId, textState, getPanel, getMode, getPageLanguage, voice }) {
    let current = null; // dernière explication affichée

    /* Texte à analyser : la sélection telle qu'affichée, plus le texte d'origine des passages
       traduits par ALPHA (en éton, l'utilisateur sélectionne de l'éton ; le glossaire
       reconnaît le terme français ou anglais d'origine). */
    function textOfRange(range, shown) {
      const parts = [shown];
      const root = range.commonAncestorContainer;
      const walker = document.createTreeWalker(root.nodeType === 3 ? root.parentNode : root, NodeFilter.SHOW_TEXT);
      let count = 0;
      while (walker.nextNode() && count < 60) {
        const node = walker.currentNode;
        if (!range.intersectsNode(node)) continue;
        count++;
        const st = textState.get(node);
        if (st && st.orig !== undefined && st.written === node.nodeValue && st.orig !== node.nodeValue) parts.push(st.orig);
      }
      return parts.join(" \n ");
    }

    function selectionInfo() {
      const selection = window.getSelection && window.getSelection();
      if (!selection || selection.isCollapsed || !selection.rangeCount) return null;
      const shown = selection.toString().trim();
      if (shown.length < 2 || shown.length > MAX_SELECTION) return null;
      const range = selection.getRangeAt(0);
      const node = range.commonAncestorContainer;
      const element = node.nodeType === 1 ? node : node.parentElement;
      if (!element || element.closest(EXCLUDED) || element.closest("#" + hostId)) return null;
      return { range, shown };
    }

    function update() {
      const panel = getPanel();
      if (!panel || !NS.explain) return;
      const info = selectionInfo();
      const result = info && NS.explain.explain(textOfRange(info.range, info.shown), getMode(), getPageLanguage());
      if (!result) {
        panel.hideExplainButton();
        return;
      }
      const rect = info.range.getBoundingClientRect();
      if (!rect || (!rect.width && !rect.height)) {
        panel.hideExplainButton();
        return;
      }
      current = { result, rect };
      panel.showExplainButton(rect, NS.explain.ui(result.lang).button);
    }

    // Clic sur « Expliquer » : la carte d'explication s'ouvre près de la sélection.
    function show() {
      const panel = getPanel();
      if (!panel || !current) return;
      const ui = NS.explain.ui(current.result.lang);
      panel.showExplainCard(current.result, current.rect, ui);
    }

    function speak() {
      if (current) voice.speakExplain(current.result.speech, current.result.lang);
    }

    function close() {
      const panel = getPanel();
      voice.stopExplain();
      if (panel) panel.hideExplainCard();
    }

    function start() {
      let timer = null;
      const schedule = () => {
        clearTimeout(timer);
        timer = setTimeout(update, 60);
      };
      const fromPanel = (event) => event.composedPath().some((node) => node && node.id === hostId);
      document.addEventListener("pointerup", (event) => { if (!fromPanel(event)) schedule(); });
      document.addEventListener("keyup", (event) => {
        if (event.shiftKey || /^Arrow/.test(event.key) || (event.key === "a" && (event.ctrlKey || event.metaKey))) schedule();
      });
      document.addEventListener("pointerdown", (event) => {
        if (fromPanel(event)) return;
        const panel = getPanel();
        if (panel) panel.hideExplainButton();
        close();
      });
      document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        const panel = getPanel();
        if (panel) panel.hideExplainButton();
        close();
      });
      window.addEventListener("scroll", () => {
        const panel = getPanel();
        if (panel) panel.hideExplainButton();
      }, true);
    }

    return { start, show, speak, close, update };
  }

  NS.explainController = { create };
})();
