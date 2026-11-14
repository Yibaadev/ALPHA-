/* Lecture vocale.
   - Français et anglais : voix installée sur l'appareil seulement (localService). Les voix
     « en ligne » de certains navigateurs enverraient le texte à un serveur, ce que le protocole interdit.
   - Éton : clips préenregistrés (src/eton-audio.js). En éton, ALPHA ne parle QU'en éton :
     un texte sans voix éton n'est jamais lu en français, l'écran le signale.
   Trois lecteurs partagent la synthèse : la lecture au clic (src/read-mode.js), le guide de
   l'écran et l'explication d'un terme sélectionné. */
(function () {
  "use strict";

  const NS = (globalThis.ALPHA = globalThis.ALPHA || {});
  const NO_ETON_VOICE = "Pas encore de voix éton pour ce texte.";

  function create({ getPanel, getMode, getPageLanguage, getEton }) {
    // Chaque lecteur a son bouton et sa ligne d'état dans le panneau.
    const readers = {
      page: {
        status: (panel, message, state) => panel.setReadStatus && panel.setReadStatus(message, state),
        speaking: (panel, value) => panel.setReadSpeaking && panel.setReadSpeaking(value),
      },
      guide: {
        status: (panel, message, state) => panel.setGuideStatus && panel.setGuideStatus(message, state),
        speaking: (panel, value) => panel.setGuideSpeaking && panel.setGuideSpeaking(value),
      },
      explain: {
        status: (panel, message, state) => panel.setExplainStatus && panel.setExplainStatus(message, state),
        speaking: (panel, value) => panel.setExplainSpeaking && panel.setExplainSpeaking(value),
      },
    };
    let speaker = null; // lecteur en cours : "page" | "guide" | "explain" | null
    let sequence = null; // suite de clips éton en cours

    function report(owner, message, state) {
      const panel = getPanel();
      if (panel && message !== undefined) readers[owner].status(panel, message, state);
    }
    function setSpeaking(owner, value) {
      const panel = getPanel();
      if (panel) readers[owner].speaking(panel, value);
    }
    const eton = () => (getEton ? getEton() : null);
    const localVoice = (language) => window.speechSynthesis.getVoices().find((candidate) =>
      candidate.localService && candidate.lang.toLowerCase().startsWith(language.slice(0, 2)));
    const textLanguage = () => {
      const mode = getMode();
      return mode === "en" || (mode === "original" && getPageLanguage() === "en") ? "en-US" : "fr-FR";
    };

    function stop(message) {
      if (!speaker) return;
      const owner = speaker;
      speaker = null;
      sequence = null;
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      if (eton()) eton().stopClip();
      setSpeaking(owner, false);
      if (typeof message === "string" && message) report(owner, message);
    }

    function speakText(owner, text, language) {
      if (!getPanel()) return;
      if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
        report(owner, "La lecture vocale n’est pas disponible dans ce navigateur.", "error");
        return;
      }
      if (speaker === owner) {
        stop("Lecture arrêtée.");
        return;
      }
      stop();
      if (!text) {
        report(owner, "Aucun texte à lire.", "notice");
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language;
      const voice = localVoice(language);
      if (!voice) {
        report(owner, "Aucune voix locale correspondante n’est installée pour cette langue.", "error");
        return;
      }

      utterance.voice = voice;
      const finish = (message) => {
        if (speaker !== owner) return; // une autre lecture a pris la main
        speaker = null;
        setSpeaking(owner, false);
        report(owner, message);
      };
      utterance.onstart = () => setSpeaking(owner, true);
      utterance.onend = () => finish("Lecture terminée.");
      utterance.onerror = (event) => {
        if (event && (event.error === "canceled" || event.error === "interrupted")) return;
        finish("La lecture a échoué. Vérifiez les voix disponibles dans le navigateur.");
      };
      speaker = owner;
      setSpeaking(owner, true);
      report(owner, "Lecture en cours…");
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }

    // Suite de clips éton ; la lecture s'arrête dès qu'une autre commence.
    async function playClips(owner, items, message) {
      const audio = eton();
      const token = {};
      sequence = token;
      speaker = owner;
      setSpeaking(owner, true);
      report(owner, message);
      try {
        for (const item of items) {
          if (sequence !== token) return;
          await audio.playClip(item.clip);
        }
        if (sequence === token) stop(message.replace("Lecture en éton", "Lu en éton"));
      } catch (e) {
        if (sequence === token) stop("La lecture du clip éton a échoué.");
      }
    }

    // Texte d'un élément pour la synthèse : son texte, ou pour un champ son libellé.
    function textForSpeech(el) {
      if (el.matches("input, select, textarea")) {
        const label = el.labels && el.labels[0];
        if (label) return textForSpeech(label);
        const value = el.matches("input[type=button], input[type=submit]") ? el.value : "";
        return (value || el.getAttribute("aria-label") || el.getAttribute("placeholder") || "").trim();
      }
      return (el.innerText != null ? el.innerText : el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 600);
    }

    // Lecture au clic : lit un seul élément de la page.
    function speakElement(el) {
      const owner = "page";
      if (!getPanel() || !el) return;
      stop();
      if (getMode() !== "local") {
        speakText(owner, textForSpeech(el), textLanguage());
        return;
      }
      const audio = eton();
      if (!audio) {
        report(owner, NO_ETON_VOICE, "notice");
        return;
      }
      audio.unlock(); // pendant le clic : Chrome n'autorise le son qu'après un geste
      const { items, missing } = audio.elementQueue(el);
      if (!items.length) {
        report(owner, NO_ETON_VOICE, "notice");
        return;
      }
      const info = audio.describe();
      let message = "Lecture en éton";
      if (info.synthetic && !info.speaker) message += " (voix de synthèse provisoire" + (info.unreviewed ? ", pas encore vérifiée" : "") + ")";
      message += ".";
      if (missing) message += " Les montants, les noms et les mots restés en français ne sont pas lus.";
      playClips(owner, items, message);
    }

    function etonMessage(missing) {
      const info = eton().describe();
      let message = "Lecture en éton";
      if (info.synthetic && !info.speaker) message += " (voix de synthèse provisoire" + (info.unreviewed ? ", pas encore vérifiée" : "") + ")";
      message += ".";
      if (missing) message += " " + missing;
      return message;
    }

    /* En éton, le guide et les explications sont lus avec les clips éton de leurs phrases, et
       jamais en français. Retourne true si le mode éton a pris la main (lu ou message affiché). */
    function speakEton(owner, texts) {
      if (getMode() !== "local") return false;
      if (speaker === owner) {
        stop();
        return true;
      }
      stop();
      const audio = eton();
      const queues = audio && texts
        ? texts.map((text) => (audio.textQueue ? audio.textQueue(text) : { items: audio.clipFor(text) ? [{ clip: audio.clipFor(text) }] : [], missing: 1 }))
        : [];
      const items = queues.flatMap((queue) => queue.items);
      if (!items.length) {
        report(owner, "Pas encore de voix éton pour ce texte : il sera lu dès que les enregistrements seront validés.", "notice");
        return true;
      }
      audio.unlock(); // pendant le clic : Chrome n'autorise le son qu'après un geste
      const missing = queues.some((queue) => queue.missing) ? "Certains passages n’ont pas encore de voix éton." : "";
      playClips(owner, items, etonMessage(missing));
      return true;
    }

    // Lecture du guide de l'écran, dans la langue du guide.
    function speakGuide(text, lang, etonTexts) {
      if (speakEton("guide", etonTexts)) return;
      speakText("guide", text, lang === "en" ? "en-US" : "fr-FR");
    }

    // Lecture de l'explication d'un terme (action « Expliquer »).
    function speakExplain(text, lang, etonTexts) {
      if (speakEton("explain", etonTexts)) return;
      speakText("explain", text, lang === "en" ? "en-US" : "fr-FR");
    }
    function stopExplain() {
      if (speaker === "explain") stop();
    }

    return { speakElement, speakGuide, speakExplain, stopExplain, stop: () => stop() };
  }

  NS.voice = { create };
})();
