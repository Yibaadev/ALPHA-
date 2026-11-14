/* Lecture vocale avec une voix locale du navigateur.
   Uniquement avec une voix installée sur l'appareil (localService) : les voix « en ligne »
   de certains navigateurs enverraient le texte lu à un serveur, ce que le protocole interdit.
   Deux lecteurs partagent la synthèse : la page entière et le guide de l'écran. */
(function () {
  "use strict";

  const NS = (globalThis.ALPHA = globalThis.ALPHA || {});

  function create({ getPanel, getMode, getPageLanguage }) {
    // Chaque lecteur a son bouton et sa ligne d'état dans le panneau.
    const readers = {
      page: {
        status: (panel, message) => panel.setVoiceStatus(message),
        speaking: (panel, value) => panel.setSpeaking(value),
      },
      guide: {
        status: (panel, message, state) => panel.setGuideStatus && panel.setGuideStatus(message, state),
        speaking: (panel, value) => panel.setGuideSpeaking && panel.setGuideSpeaking(value),
      },
    };
    let speaker = null; // lecteur en cours : "page" | "guide" | null

    function report(owner, message, state) {
      const panel = getPanel();
      if (panel && message !== undefined) readers[owner].status(panel, message, state);
    }
    function setSpeaking(owner, value) {
      const panel = getPanel();
      if (panel) readers[owner].speaking(panel, value);
    }

    function stop(message) {
      if (!speaker) return;
      const owner = speaker;
      speaker = null;
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
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
        report(owner, owner === "page" ? "Aucun texte visible à lire." : "Aucun texte à lire.", "notice");
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language;
      const voice = window.speechSynthesis.getVoices().find((candidate) =>
        candidate.localService && candidate.lang.toLowerCase().startsWith(language.slice(0, 2))
      );
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
      report(owner, "Lecture vocale en cours…");
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }

    // Lecture du contenu visible de la page.
    function speak() {
      const visibleText = (document.body.innerText || "").replace(/\s+/g, " ").trim().slice(0, 4000);
      const mode = getMode();
      const language = mode === "en" || (mode === "original" && getPageLanguage() === "en") ? "en-US" : "fr-FR";
      speakText("page", visibleText, language);
    }

    // Lecture du guide de l'écran, dans la langue du guide.
    function speakGuide(text, lang) {
      speakText("guide", text, lang === "en" ? "en-US" : "fr-FR");
    }

    return { speak, speakGuide, stop: () => stop() };
  }

  NS.voice = { create };
})();
