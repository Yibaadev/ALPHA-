/* Partie « Expliquer » du panneau ALPHA : petit bouton près du texte sélectionné et carte
   d'explication. Séparée de panel.js pour garder des fichiers courts ; styles dans panel.css. */
(function () {
  "use strict";

  const NS = (globalThis.ALPHA = globalThis.ALPHA || {});

  function markup(iconSvg) {
    return `
      <div class="selection-toolbar" role="toolbar" aria-label="Action sur le texte sélectionné" hidden>
        <button class="selection-explain" type="button">${iconSvg}<span class="selection-label">Expliquer</span></button>
      </div>
      <div class="explain-card" role="dialog" aria-modal="false" aria-labelledby="alpha-explain-title" hidden>
        <p class="explain-title" id="alpha-explain-title">Explication</p>
        <dl class="explain-list"></dl>
        <p class="explain-note"></p>
        <div class="explain-actions">
          <button class="action explain-listen" type="button" aria-pressed="false">Écouter</button>
          <button class="reset explain-close" type="button">Fermer</button>
        </div>
        <p class="voice-status explain-status" aria-live="polite"></p>
      </div>`;
  }

  // Place une boîte près de la sélection : au-dessus si possible, sinon en dessous.
  function placeNear(box, rect, preferAbove) {
    const M = 8;
    const w = box.offsetWidth;
    const h = box.offsetHeight;
    const left = Math.max(M, Math.min(window.innerWidth - w - M, rect.left + rect.width / 2 - w / 2));
    const above = rect.top - h - 8;
    const below = rect.bottom + 8;
    let top = preferAbove ? (above >= M ? above : below) : (below + h <= window.innerHeight - M ? below : above);
    top = Math.max(M, Math.min(top, window.innerHeight - h - M));
    box.style.left = left + "px";
    box.style.top = top + "px";
  }

  /* Tous les textes passent par textContent : rien de la page n'est interprété comme du HTML. */
  function attach(root, { onExplain, onExplainSpeak, onExplainClose }) {
    const $ = (sel) => root.querySelector(sel);
    const toolbar = $(".selection-toolbar");
    const card = $(".explain-card");
    let labels = { listen: "Écouter" };

    // Garde la sélection de la page quand on clique sur le bouton.
    $(".selection-explain").addEventListener("pointerdown", (event) => event.preventDefault());
    $(".selection-explain").addEventListener("click", () => {
      toolbar.hidden = true;
      if (onExplain) onExplain();
    });
    $(".explain-listen").addEventListener("click", () => onExplainSpeak && onExplainSpeak());
    $(".explain-close").addEventListener("click", () => onExplainClose && onExplainClose());
    card.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && onExplainClose) onExplainClose();
    });

    return {
      showExplainButton(rect, label) {
        $(".selection-label").textContent = label || "Expliquer";
        toolbar.hidden = false;
        placeNear(toolbar, rect, true);
      },
      hideExplainButton() {
        toolbar.hidden = true;
      },
      showExplainCard(result, rect, ui) {
        labels = ui || labels;
        $(".explain-title").textContent = result.title || ui.title || "Explication";
        const list = $(".explain-list");
        list.textContent = "";
        for (const item of result.items) {
          const dt = document.createElement("dt");
          dt.textContent = item.term;
          const dd = document.createElement("dd");
          dd.textContent = item.text;
          list.append(dt, dd);
        }
        $(".explain-note").textContent = result.note || "";
        $(".explain-listen").textContent = labels.listen || "Écouter";
        $(".explain-listen").setAttribute("aria-pressed", "false");
        $(".explain-close").textContent = labels.close || "Fermer";
        $(".explain-status").textContent = "";
        card.lang = result.lang;
        card.hidden = false;
        // Du côté de la sélection qui a le plus de place, sans jamais la recouvrir.
        const space = Math.max(window.innerHeight - rect.bottom, rect.top) - 24;
        card.style.maxHeight = Math.max(160, Math.min(420, space)) + "px";
        placeNear(card, rect, rect.top > window.innerHeight - rect.bottom);
        $(".explain-listen").focus({ preventScroll: true });
      },
      hideExplainCard() {
        card.hidden = true;
      },
      setExplainSpeaking(speaking) {
        $(".explain-listen").textContent = speaking ? "Arrêter" : labels.listen || "Écouter";
        $(".explain-listen").setAttribute("aria-pressed", String(speaking));
      },
      setExplainStatus(message, state) {
        const status = $(".explain-status");
        status.textContent = message || "";
        status.dataset.state = state || "";
      },
      // Astuce affichée sous le guide « ? ».
      setExplainHint(text) {
        const hint = $(".guide-hint");
        if (hint) hint.textContent = text || "";
      },
    };
  }

  NS.panelExplain = { markup, attach };
})();
