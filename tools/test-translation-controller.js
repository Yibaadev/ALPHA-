"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const context = vm.createContext({ console });
vm.runInContext(
  fs.readFileSync(path.join(__dirname, "..", "src", "translation-controller.js"), "utf8"),
  context,
  { filename: "src/translation-controller.js" }
);

let etonResult = null;
let machineResult = null;
const machineCalls = [];
const translate = {
  analyse(text, target) {
    if (text === "12345") return { kind: "skip" };
    if (target === "fr" && text === "Balance unavailable") return { kind: "unknown" };
    if (text === "Reference 42") return { kind: "ok", text: "Reference", values: ["42"] };
    return { kind: "unknown" };
  },
  translate() { return etonResult; },
  guessLanguage(text) { return text.includes("Balance") ? "en" : "fr"; },
};
const controller = context.ALPHA.translationController.create({
  translate,
  getCriticalData: () => ({}),
  machine(text, source, target) {
    machineCalls.push([text, source, target]);
    return machineResult;
  },
});

etonResult = { eton: "Mwàní", marqueurs_ok: true };
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(controller.translateText("  Solde  ", "local", "fr"))),
  { text: "  Mwàní  ", translated: true }
);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(controller.translateText("12345", "local", "fr"))),
  { text: "12345", translated: false }
);

etonResult = null;
machineResult = "Balance unavailable in French";
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(controller.translateText("Balance unavailable", "fr", "en"))),
  { text: "Balance unavailable in French", translated: true }
);
assert.deepStrictEqual(machineCalls.pop(), ["Balance unavailable", "en", "fr"]);

machineResult = "Référence 42";
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(controller.translateText("  Reference 42  ", "fr", "en"))),
  { text: "  Reference 42  ", translated: false }
);

console.log("Contrôleur de traduction : cascade, repli et intégrité validés.");
