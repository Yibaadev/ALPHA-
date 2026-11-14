/* Guide « ? » : explique où l'on se trouve, ce qu'il faut faire et comment.
   - Écrans connus (site de test) : textes rédigés à l'avance (data/guide.json).
   - Autres écrans : guide construit à partir des éléments visibles (titre, champs,
     bouton principal, alertes). Rien n'est inventé : les libellés cités sont ceux de la page.
   Aucun texte de la page n'est stocké ni transmis : tout se passe en mémoire, sur l'appareil. */
(function () {
  "use strict";
  const NS = (globalThis.ALPHA = globalThis.ALPHA || {});

  let data = null;

  function init(guideData) {
    data = guideData || null;
  }

  // Forme comparable d'un libellé : sans accents typographiques, astérisque, deux-points final.
  function norm(text) {
    return String(text == null ? "" : text)
      .normalize("NFC")
      .replace(/[‘’ʼ]/g, "'")
      .replace(/[\s  ]+/g, " ")
      .replace(/[\s:*]+$/, "")
      .trim()
      .toLowerCase();
  }

  function fill(template, values) {
    return String(template).replace(/\{(\w+)\}/g, (m, key) => (key in values ? values[key] : m));
  }

  function quoteList(items, lang) {
    const quoted = items.map((t) => (lang === "en" ? "“" + t + "”" : "« " + t + " »"));
    return quoted.join(", ");
  }

  function shorten(text, max) {
    const t = String(text).replace(/\s+/g, " ").trim();
    return t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t;
  }

  /* ---------- Reconnaissance de l'écran ---------- */

  function detectScreen(snapshot) {
    if (!data || !data.screens) return null;
    const present = new Set(snapshot.items.map((item) => norm(item.orig)));
    let best = null;
    let bestScore = 0;
    for (const screen of data.screens) {
      const score = screen.signals.filter((s) => present.has(norm(s))).length;
      if (score > bestScore) {
        best = screen;
        bestScore = score;
      }
    }
    return bestScore >= 2 ? best : null;
  }

  // Texte affiché d'un libellé connu ; à défaut, le libellé dans la langue du guide.
  function labelFor(key, snapshot, lang, forSpeech) {
    const variants = (data.labels && data.labels[key]) || [];
    const wanted = new Set(variants.map(norm));
    const item = snapshot.items.find((i) => wanted.has(norm(i.orig)));
    if (item && !forSpeech) return shorten(item.shown || item.orig, 60).replace(/[\s:*]+$/, "");
    return variants[lang === "en" ? 1 : 0] || key;
  }

  function adviceFor(alertText, lang) {
    const text = norm(alertText);
    for (const rule of (data && data.alerts) || []) {
      if (rule.match.some((m) => text.includes(norm(m)))) return rule[lang] || rule.fr;
    }
    return null;
  }

  /* ---------- Construction du guide ---------- */

  // mode : "fr" | "en" | "local" | "original" ; pageLanguage : "fr" | "en" | null
  function build(snapshot, mode, pageLanguage) {
    const lang = mode === "en" || (mode === "original" && pageLanguage === "en") ? "en" : "fr";
    const ui = (data && data.ui && data.ui[lang]) || {};
    // En éton, les libellés cités à voix haute sont ceux d'origine : la voix est française ou anglaise.
    const speakOriginal = mode === "local";
    const screen = detectScreen(snapshot);
    const guide = {
      lang,
      screen: screen ? screen.id : null,
      known: Boolean(screen),
      labels: { where: ui.where, what: ui.what, how: ui.how, alert: ui.alert },
      where: "",
      what: "",
      how: "",
      tip: "",
      alert: null,
      note: "",
      speech: "",
    };

    const say = { where: "", what: "", how: "", tip: "" };
    if (screen) {
      const texts = (mode === "local" && screen.local) || screen[lang];
      const shown = {};
      const spoken = {};
      for (const key of Object.keys(data.labels || {})) {
        shown[key] = labelFor(key, snapshot, lang, false);
        spoken[key] = speakOriginal ? labelFor(key, snapshot, lang, true) : shown[key];
      }
      for (const part of ["where", "what", "how", "tip"]) {
        guide[part] = texts[part] ? fill(texts[part], shown) : "";
        say[part] = texts[part] ? fill(texts[part], spoken) : "";
      }
      guide.note = ui.known || "";
    } else {
      const generic = genericGuide(snapshot, lang, ui, false);
      Object.assign(guide, generic);
      Object.assign(say, speakOriginal ? genericGuide(snapshot, lang, ui, true) : generic);
      guide.note = ui.auto || "";
    }

    // Alerte visible : on la cite telle qu'affichée, avec un conseil si on la connaît.
    const alertItem = snapshot.items.find((item) => item.kind === "alert");
    if (alertItem) {
      const advice = adviceFor(alertItem.orig, lang) || ui.unknownAlert || "";
      guide.alert = { text: shorten(alertItem.shown || alertItem.orig, 180), advice };
    }
    if (mode === "local" && !(screen && screen.local)) {
      guide.note = (ui.etonPending || "") + (guide.note ? " " + guide.note : "");
    }

    guide.speech = [
      say.where,
      guide.alert ? (guide.labels.alert || "") + " : " + (speakOriginal ? "" : guide.alert.text + ". ") + guide.alert.advice : "",
      say.what,
      say.how,
      say.tip,
    ].filter(Boolean).join(" ");
    return guide;
  }

  function genericGuide(snapshot, lang, ui, useOriginal) {
    const text = (item) => shorten((useOriginal ? item.orig : item.shown) || item.orig || item.shown || "", 50)
      .replace(/[\s:*]+$/, "");
    const heading = snapshot.items.find((item) => item.kind === "heading");
    const title = heading ? text(heading) : shorten(snapshot.title || "", 60);
    const fields = snapshot.items.filter((item) => item.kind === "field").map(text).filter(Boolean);
    const checks = snapshot.items.filter((item) => item.kind === "check").map(text).filter(Boolean);
    const buttons = snapshot.items.filter((item) => item.kind === "button");
    const primary = buttons.find((item) => item.primary) || null;
    const others = buttons.filter((item) => item !== primary).map(text).filter(Boolean);

    const where = title ? fill(ui.page, { title }) : ui.untitled;
    const parts = [];
    if (fields.length) parts.push(fill(ui.fill, { list: quoteList(unique(fields).slice(0, 5), lang) }));
    if (checks.length) parts.push(fill(ui.check, { list: quoteList(unique(checks).slice(0, 3), lang) }));
    if (!parts.length) parts.push(buttons.length ? ui.chooseAction : ui.readOnly);
    let how = "";
    if (primary) {
      how = fill(ui.press, { button: text(primary) });
      if (others.length) how += " " + fill(ui.others, { list: quoteList(unique(others).slice(0, 3), lang) });
    } else if (others.length) {
      how = fill(ui.others, { list: quoteList(unique(others).slice(0, 4), lang) });
    } else {
      how = ui.noButton;
    }
    const tip = snapshot.items.some((item) => item.secret) ? ui.secretTip : "";
    return { where, what: parts.join(" "), how, tip };
  }

  function unique(list) {
    const seen = new Set();
    return list.filter((t) => {
      const k = norm(t);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  /* ---------- Lecture de la page (navigateur uniquement) ---------- */

  const PRIMARY_WORDS = /continu|suivant|valider|confirm|envoyer|payer|soumettre|enregistrer|connexion|se connecter|transf|next|submit|send|pay|save|sign in|log in|proceed/i;
  const SECRET_WORDS = /\b(code|pin|otp|mot de passe|password|cvv|cvc)\b/i;
  const ALERT_CLASS = /(^|[\s_-])(alert|error|danger|warning|toast|notice)([\s_-]|$)/i;
  const ALERT_TEXT = /^(alerte|attention|avertissement|erreur|échec|security warning|warning|error|alert|caution|message important|important message)\b/i;

  function isVisible(el) {
    if (typeof el.checkVisibility === "function") {
      return el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
    }
    for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
      if (node.hidden) return false;
      const style = node.ownerDocument.defaultView.getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden") return false;
    }
    return true;
  }

  /* Relevé des éléments utiles de la page.
     helpers.origText(el) : texte d'origine (avant traduction) ;
     helpers.origAttr(el, name) : attribut d'origine ;
     helpers.skip(el) : vrai pour le panneau ALPHA. */
  function snapshot(doc, helpers) {
    const items = [];
    const body = doc.body;
    if (!body) return { title: doc.title || "", items };
    const shownOf = (el) => (el.innerText != null ? el.innerText : el.textContent || "").replace(/\s+/g, " ").trim();
    const origOf = (el) => (helpers.origText(el) || "").replace(/\s+/g, " ").trim();
    const attr = (el, name) => (el.hasAttribute(name) ? { orig: helpers.origAttr(el, name), shown: el.getAttribute(name) } : null);
    const push = (kind, el, orig, shown, extra) => {
      if (!orig && !shown) return;
      items.push(Object.assign({ kind, orig: orig || shown, shown: shown || orig }, extra || {}));
    };

    const interactive = body.querySelectorAll(
      "h1, h2, [role=heading], button, [role=button], input, select, textarea, label, dt, th"
    );
    let count = 0;
    for (const el of interactive) {
      if (++count > 1500) break;
      if (helpers.skip(el) || !isVisible(el)) continue;
      const tag = el.tagName;
      if (tag === "H1" || tag === "H2" || el.getAttribute("role") === "heading") {
        push("heading", el, origOf(el), shownOf(el));
      } else if (tag === "BUTTON" || el.getAttribute("role") === "button" ||
        (tag === "INPUT" && /^(button|submit)$/i.test(el.type))) {
        if (el.disabled) continue;
        const label = tag === "INPUT" ? attr(el, "value") : { orig: origOf(el), shown: shownOf(el) };
        const aria = attr(el, "aria-label");
        const best = label && label.shown ? label : aria;
        if (!best || !best.shown || best.shown.length > 60) continue;
        push("button", el, best.orig, best.shown, { submit: el.type === "submit", inForm: Boolean(el.closest("form")) });
      } else if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") {
        if (tag === "INPUT" && /^(hidden|reset|image|file|range|color)$/i.test(el.type)) continue;
        const label = fieldLabel(el, doc, helpers, shownOf, origOf);
        const secret = (tag === "INPUT" && el.type === "password") || el.autocomplete === "one-time-code" ||
          SECRET_WORDS.test(label ? label.orig : "");
        const kind = tag === "INPUT" && /^(checkbox|radio)$/i.test(el.type) ? "check" : "field";
        if (label) push(kind, el, label.orig, label.shown, { secret });
        else if (secret) items.push({ kind, orig: "", shown: "", secret });
      } else {
        push("text", el, origOf(el), shownOf(el));
      }
    }

    // Textes simples : les alertes, et les libellés courts qui servent de repères d'écran.
    const texts = body.querySelectorAll(
      "[role=alert], [role=alertdialog], [aria-live=assertive], [class*=alert], [class*=error], " +
      "[class*=warning], [class*=danger], p, span, div, li"
    );
    count = 0;
    for (const el of texts) {
      if (++count > 2500) break;
      if (el.children.length > 3 || helpers.skip(el)) continue;
      const shown = shownOf(el);
      if (!shown || shown.length > 220 || !isVisible(el)) continue;
      const orig = origOf(el);
      const role = el.getAttribute("role");
      const className = typeof el.className === "string" ? el.className : "";
      const alerting = role === "alert" || role === "alertdialog" || el.getAttribute("aria-live") === "assertive" ||
        (ALERT_CLASS.test(className) && shown.length > 12) || ALERT_TEXT.test(orig) || ALERT_TEXT.test(shown);
      if (alerting) push("alert", el, orig, shown);
      else if (el.children.length === 0 && shown.length <= 90) push("text", el, orig, shown);
    }

    // Bouton principal : bouton d'envoi, verbe d'action, dans un formulaire ; à égalité, le dernier.
    const buttons = items.filter((item) => item.kind === "button");
    let primary = null;
    let bestScore = -1;
    buttons.forEach((item, index) => {
      let score = (item.submit ? 3 : 0) + (PRIMARY_WORDS.test(item.orig) || PRIMARY_WORDS.test(item.shown) ? 2 : 0) +
        (item.inForm ? 1 : 0) + index / 1000;
      if (/^(fermer|close|dismiss|annuler|cancel|retour|back|menu|×|x)$/i.test(norm(item.orig))) score -= 5;
      if (score > bestScore) {
        bestScore = score;
        primary = item;
      }
    });
    if (primary && bestScore >= 1) primary.primary = true;
    return { title: doc.title || "", items };
  }

  function fieldLabel(el, doc, helpers, shownOf, origOf) {
    // el.labels : <label for="…"> et <label> englobant, selon le standard HTML.
    let label = el.labels && el.labels.length ? el.labels[0] : null;
    if (!label) label = el.closest("label");
    if (label) {
      const shown = shownOf(label);
      if (shown) return { orig: origOf(label), shown };
    }
    for (const name of ["aria-label", "placeholder", "title"]) {
      if (el.hasAttribute(name) && el.getAttribute(name).trim()) {
        return { orig: helpers.origAttr(el, name), shown: el.getAttribute(name) };
      }
    }
    // Libellé posé juste avant le champ (structure fréquente sans <label for>).
    const prev = el.parentElement && el.parentElement.previousElementSibling;
    if (prev && prev.tagName === "LABEL") return { orig: origOf(prev), shown: shownOf(prev) };
    return null;
  }

  function intro(mode, pageLanguage) {
    if (!data || !data.intro) return null;
    if (mode === "local" && data.intro.local) return data.intro.local;
    const lang = mode === "en" || (mode === "original" && pageLanguage === "en") ? "en" : "fr";
    return data.intro[lang];
  }

  NS.guide = { init, build, snapshot, detectScreen, intro, norm };
})();
