/* Partie « Lecture au clic » du panneau ALPHA : bandeau du mode lecture et cadre autour du
   texte visé. Séparée de panel.js pour garder des fichiers courts ; styles dans panel-help.css. */
(function () {
  "use strict";

  const NS = (globalThis.ALPHA = globalThis.ALPHA || {});

  function markup(iconSvg) {
    return `
      <div class="read-highlight" aria-hidden="true" hidden></div>
      <div class="read-pill" role="status" hidden>
        <span class="read-pill-icon">${iconSvg}</span>
        <span class="read-pill-copy">
          <strong class="read-pill-title">Lecture au clic</strong>
          <span class="read-pill-status" aria-live="polite">Touchez un texte pour l’entendre.</span>
        </span>
        <button class="read-pill-exit" type="button">Quitter</button>
      </div>`;
  }

  function attach(root, { onReadExit }) {
    const $ = (sel) => root.querySelector(sel);
    const pill = $(".read-pill");
    const box = $(".read-highlight");
    const button = $(".speak");
    $(".read-pill-exit").addEventListener("click", () => onReadExit && onReadExit());

    function setStatus(message, state) {
      for (const el of [$(".read-pill-status"), $(".voice-status")]) {
        el.textContent = message || "";
        el.dataset.state = state || "";
      }
    }

    return {
      // Mode lecture activé ou non : bouton du panneau et bandeau.
      setReadMode(on) {
        button.textContent = on ? "Désactiver" : "Activer";
        button.setAttribute("aria-pressed", String(on));
        pill.hidden = !on;
        if (!on) box.hidden = true;
        setStatus(on
          ? "Touchez un texte pour l’entendre. Les clics ne déclenchent rien sur le site tant que ce mode est actif."
          : "Activez la lecture au clic, puis touchez un texte de la page.");
      },
      setReadStatus: setStatus,
      // Cadre autour du texte survolé ou lu (null : masqué).
      highlight(rect) {
        if (!rect || (!rect.width && !rect.height)) {
          box.hidden = true;
          return;
        }
        const pad = 4;
        box.style.left = rect.left - pad + "px";
        box.style.top = rect.top - pad + "px";
        box.style.width = rect.width + pad * 2 + "px";
        box.style.height = rect.height + pad * 2 + "px";
        box.hidden = false;
      },
      setReadSpeaking(speaking) {
        box.classList.toggle("reading", Boolean(speaking));
      },
    };
  }

  NS.panelRead = { markup, attach };
})();
