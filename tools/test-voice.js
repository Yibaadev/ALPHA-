"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let currentUtterance = null;
let cancelCount = 0;
let availableVoices = [{ localService: true, lang: "fr-FR" }, { localService: true, lang: "en-US" }];
const panelEvents = [];
class Utterance {
  constructor(text) { this.text = text; }
}
const synthesis = {
  cancel() { cancelCount++; },
  getVoices() { return availableVoices; },
  speak(utterance) { currentUtterance = utterance; },
};
const window = { speechSynthesis: synthesis, SpeechSynthesisUtterance: Utterance };
const context = vm.createContext({
  console,
  window,
  document: { body: { innerText: "  Texte visible   à lire.\n" } },
  SpeechSynthesisUtterance: Utterance,
});
vm.runInContext(
  fs.readFileSync(path.join(__dirname, "..", "src", "voice.js"), "utf8"),
  context,
  { filename: "src/voice.js" }
);

let mode = "fr";
const panel = {
  setSpeaking(value) { panelEvents.push(["speaking", value]); },
  setVoiceStatus(value) { panelEvents.push(["status", value]); },
};
const voice = context.ALPHA.voice.create({
  getPanel: () => panel,
  getMode: () => mode,
  getPageLanguage: () => "fr",
});

voice.speak();
assert.strictEqual(currentUtterance.text, "Texte visible à lire.");
assert.strictEqual(currentUtterance.lang, "fr-FR");
assert.strictEqual(currentUtterance.voice.lang, "fr-FR");
currentUtterance.onstart();
assert.ok(panelEvents.some(([type, value]) => type === "speaking" && value === true));
voice.stop();
assert.strictEqual(cancelCount, 2);

mode = "en";
voice.speak();
assert.strictEqual(currentUtterance.lang, "en-US");
currentUtterance.onerror();
assert.ok(panelEvents.some(([type, value]) => type === "status" && value.includes("lecture a échoué")));

mode = "fr";
availableVoices = [];
voice.speak();
assert.ok(panelEvents.some(([type, value]) => type === "status" && value.includes("Aucune voix locale")));

console.log("Lecture vocale : langue, démarrage, arrêt et erreurs validés.");
