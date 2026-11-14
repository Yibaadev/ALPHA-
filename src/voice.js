/* Lecture vocale avec une voix locale du navigateur. */
(function () {
  "use strict";

  const NS = (globalThis.ALPHA = globalThis.ALPHA || {});

  function create({ getPanel, getMode, getPageLanguage }) {
    let speaking = false;

    function setSpeaking(value, panel) {
      speaking = value;
      panel.setSpeaking(value);
    }

    function stop() {
      if (!speaking || !("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      speaking = false;
      const panel = getPanel();
      if (panel) panel.setSpeaking(false);
    }

    function speak() {
      const panel = getPanel();
      if (!panel) return;
      if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
        panel.setVoiceStatus("La lecture vocale n’est pas disponible dans ce navigateur.");
        return;
      }
      if (speaking) {
        window.speechSynthesis.cancel();
        setSpeaking(false, panel);
        panel.setVoiceStatus("Lecture arrêtée.");
        return;
      }

      const visibleText = (document.body.innerText || "").replace(/\s+/g, " ").trim().slice(0, 4000);
      if (!visibleText) {
        panel.setVoiceStatus("Aucun texte visible à lire.");
        return;
      }

      const utterance = new SpeechSynthesisUtterance(visibleText);
      const mode = getMode();
      const language = mode === "en" || (mode === "original" && getPageLanguage() === "en")
        ? "en-US"
        : "fr-FR";
      utterance.lang = language;
      const voice = window.speechSynthesis.getVoices().find((candidate) =>
        candidate.localService && candidate.lang.toLowerCase().startsWith(language.slice(0, 2))
      );
      if (!voice) {
        panel.setVoiceStatus("Aucune voix locale correspondante n’est installée pour cette langue.");
        return;
      }

      utterance.voice = voice;
      utterance.onstart = () => setSpeaking(true, panel);
      utterance.onend = () => {
        setSpeaking(false, panel);
        panel.setVoiceStatus("Lecture terminée.");
      };
      utterance.onerror = () => {
        setSpeaking(false, panel);
        panel.setVoiceStatus("La lecture a échoué. Vérifiez les voix disponibles dans le navigateur.");
      };
      panel.setVoiceStatus("Lecture vocale en cours…");
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }

    return { speak, stop };
  }

  NS.voice = { create };
})();
