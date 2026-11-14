/* « Lecture au clic » : l'utilisateur active le mode, puis touche un texte de la page ;
   seul ce texte est lu. Pratique courante des outils d'accessibilité (lecture à la demande),
   plus utile qu'une lecture de toute la page.
   Tant que le mode est actif, les clics ne déclenchent RIEN sur le site : toucher
   « Confirmer le transfert » pour l'entendre ne doit jamais confirmer le transfert. */
(function () {
  "use strict";

  const NS = (globalThis.ALPHA = globalThis.ALPHA || {});
  const MAX_TEXT = 600;
  // Éléments lus d'un seul bloc : un bouton, un lien, un titre, un paragraphe, une cellule…
  const READABLE = "button, a, label, summary, option, legend, caption, figcaption, " +
    "[role=button], [role=link], [role=alert], [role=heading], [role=tab], [role=menuitem], " +
    "h1, h2, h3, h4, h5, h6, p, li, td, th, dt, dd, blockquote";
  // Événements interceptés pendant le mode lecture (le défilement reste possible).
  const BLOCKED = ["pointerdown", "pointerup", "mousedown", "mouseup", "click", "dblclick", "auxclick", "contextmenu"];

  const textOf = (el) => (el.innerText != null ? el.innerText : el.textContent || "").replace(/\s+/g, " ").trim();

  function create({ hostId, getPanel, voice }) {
    let on = false;
    let current = null; // bloc lu en dernier

    const fromPanel = (event) => event.composedPath().some((node) => node && node.id === hostId);

    // Bloc de texte à lire à partir de l'élément touché.
    function blockFor(target) {
      let el = target && (target.nodeType === 1 ? target : target.parentElement);
      if (!el || el === document.body || el.closest("#" + hostId)) return null;
      if (el.matches("input, select, textarea")) return el;
      const readable = el.closest(READABLE);
      if (readable && readable !== document.body && textOf(readable) && textOf(readable).length <= MAX_TEXT) return readable;
      for (let node = el; node && node !== document.body; node = node.parentElement) {
        const text = textOf(node);
        if (text.length > MAX_TEXT) break;
        if (text) return node;
      }
      return null;
    }

    function highlight(el) {
      const panel = getPanel();
      if (panel) panel.highlight(el ? el.getBoundingClientRect() : null);
    }

    function read(el) {
      if (!el) return;
      current = el;
      highlight(el);
      voice.speakElement(el);
    }

    function swallow(event) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }

    function onPointer(event) {
      if (!on || fromPanel(event)) return;
      swallow(event);
      if (event.type === "click") read(blockFor(event.target));
    }

    function onMove(event) {
      if (!on || fromPanel(event) || event.pointerType === "touch") return;
      const el = blockFor(event.target);
      if (el !== current) highlight(el);
    }

    // Clavier : Échap quitte ; Entrée ou Espace lit l'élément qui a le focus, sans l'activer.
    function onKey(event) {
      if (!on || fromPanel(event)) return;
      if (event.key === "Escape") {
        swallow(event);
        set(false);
      } else if (event.key === "Enter" || event.key === " ") {
        const el = blockFor(document.activeElement);
        if (el) {
          swallow(event);
          read(el);
        }
      }
    }

    function onScroll() {
      if (on) highlight(null);
    }

    function set(value) {
      if (on === Boolean(value)) return;
      on = Boolean(value);
      const method = on ? "addEventListener" : "removeEventListener";
      for (const type of BLOCKED) window[method](type, onPointer, true);
      window[method]("pointermove", onMove, true);
      window[method]("keydown", onKey, true);
      window[method]("scroll", onScroll, true);
      current = null;
      voice.stop(); // une seule lecture à la fois : le guide ou une explication en cours s'arrête
      const panel = getPanel();
      if (panel) panel.setReadMode(on);
    }

    return { toggle: () => set(!on), stop: () => set(false), isOn: () => on, blockFor };
  }

  NS.readMode = { create };
})();
