/* Partie « guide » du panneau ALPHA : section « Guide de cet écran » et bulle de présentation
   du drapeau. Séparée de panel.js pour garder des fichiers courts ; styles dans panel.css. */
(function () {
  "use strict";

  const NS = (globalThis.ALPHA = globalThis.ALPHA || {});

  // Section du tiroir, insérée par panel.js après la section des langues.
  function sectionMarkup() {
    return `
          <section class="section" data-section="guide">
            <h2 class="section-heading">Guide de cet écran</h2>
            <div class="guide-card">
              <div class="guide-alert" role="alert" hidden><strong class="guide-alert-label"></strong><span class="guide-alert-text"></span><span class="guide-alert-advice"></span></div>
              <dl class="guide-list">
                <dt class="g-where-label">Où suis-je ?</dt><dd class="g-where">…</dd>
                <dt class="g-what-label">Que faire ?</dt><dd class="g-what"></dd>
                <dt class="g-how-label">Comment ?</dt><dd class="g-how"></dd>
              </dl>
              <p class="guide-tip" hidden></p>
            </div>
            <p class="guide-note"></p>
            <p class="guide-hint"></p>
            <div class="guide-actions">
              <button class="action guide-speak" type="button" aria-pressed="false">Écouter le guide</button>
              <button class="reset guide-refresh" type="button">Actualiser</button>
            </div>
            <p class="voice-status guide-status" aria-live="polite"></p>
            <details class="guide-about">
              <summary class="about-summary">Ce drapeau qui flotte, c’est quoi ?</summary>
              <div class="about-body"></div>
            </details>
          </section>`;
  }

  // Bulle affichée à côté de la carte flottante.
  function introMarkup() {
    return `
      <div class="intro" role="dialog" aria-modal="false" aria-labelledby="alpha-intro-title" hidden>
        <p class="intro-title" id="alpha-intro-title"></p>
        <div class="intro-body"></div>
        <button class="intro-ok" type="button">Compris !</button>
      </div>`;
  }

  function fillLines(container, lines) {
    container.textContent = "";
    for (const line of lines) {
      const p = document.createElement("p");
      p.textContent = line;
      container.appendChild(p);
    }
  }

  /* Branche les comportements et renvoie les méthodes ajoutées à l'API du panneau.
     Tous les textes passent par textContent : rien de la page n'est interprété comme du HTML. */
  function attach(root, { launcher, onGuide, onGuideSpeak }) {
    const $ = (sel) => root.querySelector(sel);
    const intro = $(".intro");
    let introDone = null;

    if (onGuideSpeak) $(".guide-speak").addEventListener("click", onGuideSpeak);
    if (onGuide) $(".guide-refresh").addEventListener("click", () => onGuide());

    // À côté de la carte, du côté où il y a de la place ; sinon au-dessus ou en dessous.
    function placeIntro() {
      if (intro.hidden) return;
      const M = 12;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const r = launcher.getBoundingClientRect();
      const w = intro.offsetWidth;
      const h = intro.offsetHeight;
      let x = r.left + r.width / 2 > vw / 2 ? r.left - w - 10 : r.right + 10;
      let y = r.top + r.height / 2 - h / 2;
      if (x < M || x + w > vw - M) {
        x = r.left + r.width / 2 - w / 2;
        y = r.top - h - 10 >= M ? r.top - h - 10 : r.bottom + 10;
      }
      intro.style.left = Math.min(Math.max(M, x), Math.max(M, vw - w - M)) + "px";
      intro.style.top = Math.min(Math.max(M, y), Math.max(M, vh - h - M)) + "px";
    }
    function hideIntro() {
      if (intro.hidden) return;
      intro.hidden = true;
      const done = introDone;
      introDone = null;
      if (done) done();
    }
    $(".intro-ok").addEventListener("click", () => {
      hideIntro();
      launcher.focus();
    });
    intro.addEventListener("keydown", (e) => { if (e.key === "Escape") hideIntro(); });
    launcher.addEventListener("pointerdown", hideIntro);
    launcher.addEventListener("click", hideIntro);
    window.addEventListener("resize", placeIntro);

    const set = (sel, text) => { $(sel).textContent = text || ""; };

    return {
      setGuide(guide) {
        set(".g-where-label", guide.labels.where);
        set(".g-what-label", guide.labels.what);
        set(".g-how-label", guide.labels.how);
        set(".g-where", guide.where);
        set(".g-what", guide.what);
        set(".g-how", guide.how);
        const tip = $(".guide-tip");
        tip.textContent = guide.tip || "";
        tip.hidden = !guide.tip;
        const alertBox = $(".guide-alert");
        alertBox.hidden = !guide.alert;
        if (guide.alert) {
          set(".guide-alert-label", guide.labels.alert);
          set(".guide-alert-text", guide.lang === "en" ? "“" + guide.alert.text + "”" : "« " + guide.alert.text + " »");
          set(".guide-alert-advice", guide.alert.advice);
        }
        set(".guide-note", guide.note);
        $('[data-section="guide"]').lang = guide.lang;
      },
      setGuideStatus(message, state) {
        const status = $(".guide-status");
        status.textContent = message || "";
        status.dataset.state = state || "";
      },
      setGuideSpeaking(speaking) {
        const button = $(".guide-speak");
        button.textContent = speaking ? "Arrêter" : "Écouter le guide";
        button.setAttribute("aria-pressed", String(speaking));
      },
      // Textes de la bulle « Moi, c'est ALPHA », repris aussi en bas du guide.
      setIntroTexts(texts) {
        if (!texts) return;
        set(".about-summary", texts.about || "Ce drapeau qui flotte, c’est quoi ?");
        fillLines($(".about-body"), [texts.title].concat(texts.lines || []));
      },
      showIntro(texts, onDone) {
        if (!texts || launcher.hidden) return;
        set(".intro-title", texts.title);
        fillLines($(".intro-body"), texts.lines || []);
        set(".intro-ok", texts.ok || "OK");
        introDone = onDone || null;
        intro.hidden = false;
        placeIntro();
      },
      hideIntro,
    };
  }

  NS.panelGuide = { sectionMarkup, introMarkup, attach };
})();
