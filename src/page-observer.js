/* Surveillance des changements de la page, économe pour le processeur :
   - plusieurs changements rapprochés donnent UN seul passage de traduction ;
   - onglet en arrière-plan : rien n'est fait, un seul passage au retour sur l'onglet. */
(function () {
  "use strict";

  const NS = (globalThis.ALPHA = globalThis.ALPHA || {});

  // onChange : passage de traduction ; lastCost : durée du dernier passage (ms).
  function create(onChange, lastCost) {
    let waiting = false;
    let pendingWhileHidden = false;
    const observer = new MutationObserver(() => {
      if (document.hidden) {
        pendingWhileHidden = true;
        return;
      }
      if (waiting) return;
      waiting = true;
      setTimeout(() => {
        waiting = false;
        onChange();
      }, lastCost() < 12 ? 30 : 200);
    });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && pendingWhileHidden) {
        pendingWhileHidden = false;
        onChange();
      }
    });
    return observer;
  }

  NS.pageObserver = { create };
})();
