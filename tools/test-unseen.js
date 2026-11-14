"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const context = vm.createContext({ console });
for (const file of [
  "src/protect.js",
  "src/confidence.js",
  "src/engine/common.js",
  "src/engine/templates.js",
  "src/engine/fuzzy.js",
  "src/engine/segments.js",
  "src/engine/rules.js",
  "src/engine/language.js",
  "src/translate.js",
]) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
}

const NS = context.ALPHA;
const dictionary = require(path.join(root, "data", "dictionary.json"));
const criticalTerms = require(path.join(root, "data", "critical_terms.json"));
const templates = require(path.join(root, "data", "templates.json"));
const lexicon = require(path.join(root, "data", "lexicon.json"));
const rules = require(path.join(root, "data", "rules.json"));
const messages = require(path.join(root, "tests", "unseen", "messages.json"));

assert.strictEqual(messages.length, 15, "le jeu de tests contient 15 messages inédits");
NS.translate.init(dictionary, { criticalTerms, templates, lexicon, rules });
const protection = NS.protect.build(dictionary.meta && dictionary.meta.names || []);
const rows = messages.map((original) => {
  const result = NS.translate.translate(original, { target: "eton" });
  assert.strictEqual(result.original, original, "le texte source doit rester intact");
  assert.ok(["valide", "probable", "automatique", "non_traduit"].includes(result.statut));
  assert.ok(["exact", "template", "fuzzy", "segments", "regles", "aucune"].includes(result.source));
  if (result.statut === "non_traduit") {
    assert.strictEqual(result.eton, null);
  } else {
    assert.strictEqual(result.marqueurs_ok, true);
    assert.strictEqual(typeof result.eton, "string");
    const sourceValues = NS.protect.protect(original, protection).values;
    const targetValues = NS.protect.protect(result.eton, protection).values;
    assert.deepStrictEqual(Array.from(targetValues), Array.from(sourceValues), "valeurs protégées préservées");
  }
  return {
    message: original,
    statut: result.statut,
    source: result.source,
    marqueurs_ok: result.marqueurs_ok,
  };
});

for (const trappedPair of [
  ["Transfert effectué : 25 000 FCFA.", "Transfert échoué : 25 000 FCFA."],
  ["Votre solde est suffisant.", "Votre solde est insuffisant."],
]) {
  const outputs = trappedPair.map((original) => NS.translate.translate(original, { target: "eton" }));
  for (let i = 0; i < outputs.length; i++) {
    assert.strictEqual(outputs[i].statut, "non_traduit", trappedPair[i]);
    assert.strictEqual(outputs[i].eton, null, trappedPair[i]);
  }
}

console.table(rows);
console.log("15 messages inédits vérifiés : aucune perte de valeur protégée ni inversion sur les paires piégées.");
