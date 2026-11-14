"use strict";

// Lecture vocale (src/voice.js) : lecture d'un élément touché, langue, arrêt, erreurs,
// et règle « en éton, uniquement des voix éton ».

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let currentUtterance = null;
let spokenCount = 0;
let cancelCount = 0;
let availableVoices = [{ localService: true, lang: "fr-FR" }, { localService: true, lang: "en-US" }];
const panelEvents = [];
class Utterance {
  constructor(text) { this.text = text; }
}
const synthesis = {
  cancel() { cancelCount++; },
  getVoices() { return availableVoices; },
  speak(utterance) { currentUtterance = utterance; spokenCount++; },
};
const window = { speechSynthesis: synthesis, SpeechSynthesisUtterance: Utterance };
const context = vm.createContext({ console, window, SpeechSynthesisUtterance: Utterance });
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "src", "voice.js"), "utf8"), context, { filename: "src/voice.js" });

// Élément de page minimal.
const element = (text) => ({ innerText: "  " + text + "\n", matches: () => false });

let mode = "fr";
const panel = {
  setReadSpeaking(value) { panelEvents.push(["speaking", value]); },
  setReadStatus(value) { panelEvents.push(["status", value]); },
  setGuideStatus(value) { panelEvents.push(["guide", value]); },
  setGuideSpeaking() {},
};
// Faux lecteur de clips éton : seul « Mwàní » a une voix.
const played = [];
const eton = {
  unlock() {},
  describe: () => ({ count: 1, speaker: false, synthetic: true, unreviewed: true }),
  elementQueue: (el) => (el.innerText.includes("Mwàní") ? { items: [{ clip: { file: "omnivoice/dict.balance.ogg" } }], missing: 1 } : { items: [], missing: 1 }),
  playClip: async (clip) => { played.push(clip.file); },
  stopClip() {},
  clipFor: (text) => (text === "Mə̀ nə̀ vé ?" ? { file: "omnivoice/guide.ogg" } : null),
};
const voice = context.ALPHA.voice.create({
  getPanel: () => panel,
  getMode: () => mode,
  getPageLanguage: () => "fr",
  getEton: () => eton,
});
const lastStatus = () => [...panelEvents].reverse().find(([type]) => type === "status")[1];

(async () => {
  // Français : seul le texte touché est lu, avec la voix locale française.
  voice.speakElement(element("Solde   disponible"));
  assert.strictEqual(currentUtterance.text, "Solde disponible");
  assert.strictEqual(currentUtterance.lang, "fr-FR");
  assert.strictEqual(currentUtterance.voice.lang, "fr-FR");
  currentUtterance.onstart();
  assert.ok(panelEvents.some(([type, value]) => type === "speaking" && value === true));
  voice.stop();
  assert.strictEqual(cancelCount, 2);

  // Anglais, puis erreur de synthèse.
  mode = "en";
  voice.speakElement(element("Available balance"));
  assert.strictEqual(currentUtterance.lang, "en-US");
  currentUtterance.onerror();
  assert.ok(lastStatus().includes("lecture a échoué"));

  // Pas de voix locale installée.
  mode = "fr";
  availableVoices = [];
  voice.speakElement(element("Frais"));
  assert.ok(lastStatus().includes("Aucune voix locale"));
  availableVoices = [{ localService: true, lang: "fr-FR" }];

  // Éton : le clip éton est lu, jamais la synthèse française.
  mode = "local";
  const before = spokenCount;
  voice.speakElement(element("Mwàní 250 000 FCFA"));
  await new Promise((r) => setTimeout(r, 10));
  assert.deepStrictEqual(played, ["omnivoice/dict.balance.ogg"]);
  assert.strictEqual(spokenCount, before, "aucune phrase française en mode éton");
  assert.ok(/synthèse provisoire/.test(panelEvents.find(([t, v]) => t === "status" && /éton/.test(v))[1]));

  // Éton sans clip : message à l'écran, rien n'est lu en français.
  voice.speakElement(element("Texte inédit"));
  assert.strictEqual(spokenCount, before);
  assert.strictEqual(lastStatus(), "Pas encore de voix éton pour ce texte.");

  // Éton : le guide (encore en français) n'est pas lu.
  voice.speakGuide("Où suis-je ? Récapitulatif.", "fr");
  assert.strictEqual(spokenCount, before);
  assert.ok(panelEvents.some(([type, value]) => type === "guide" && /Pas encore de voix éton/.test(value)));

  // Éton : guide traduit et enregistré -> clips éton de ses phrases, toujours sans français.
  played.length = 0;
  voice.speakGuide("texte français", "fr", ["Mə̀ nə̀ vé ?", "Phrase sans clip"]);
  await new Promise((r) => setTimeout(r, 10));
  assert.deepStrictEqual(played, ["omnivoice/guide.ogg"]);
  assert.strictEqual(spokenCount, before);
  assert.ok(panelEvents.some(([type, value]) => type === "guide" && /Certains passages/.test(value)));

  console.log("Lecture vocale : lecture au clic, langue, arrêt, erreurs et éton sans français validés.");
})().catch((e) => {
  console.error("ÉCHEC : " + e.message);
  process.exitCode = 1;
});
