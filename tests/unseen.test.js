"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const context = vm.createContext({ console });
for (const file of [
  "extension/src/engine/protect.js",
  "extension/src/engine/confidence.js",
  "extension/src/engine/common.js",
  "extension/src/engine/templates.js",
  "extension/src/engine/fuzzy.js",
  "extension/src/engine/segments.js",
  "extension/src/engine/rules.js",
  "extension/src/engine/language.js",
  "extension/src/engine/translate.js",
]) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
}

const NS = context.ALPHA;
const dictionary = require(path.join(root, "extension", "data", "dictionary.json"));
const criticalTerms = require(path.join(root, "extension", "data", "critical_terms.json"));
const templates = require(path.join(root, "extension", "data", "templates.json"));
const lexicon = require(path.join(root, "content", "lexique", "lexicon.json"));
const rules = require(path.join(root, "extension", "data", "rules.json"));
const messages = require(path.join(root, "tests", "fixtures", "unseen-messages.json"));

assert.strictEqual(messages.length, 15, "le jeu de tests contient 15 messages inédits");
NS.translate.init(dictionary, { criticalTerms, templates, lexicon, rules });
const protection = NS.protect.build(dictionary.meta && dictionary.meta.names || []);
const rows = messages.map((original) => {
  const result = NS.translate.translate(original, { target: "eton" });
  assert.strictEqual(result.original, original, "le texte source doit rester intact");
  assert.ok(["valide", "probable", "automatique", "non_traduit"].includes(result.statut));
  assert.ok(["exact", "template", "fuzzy", "segments", "regles", "phrases", "aucune"].includes(result.source));
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

// Paires piégées : jamais d'inversion. « Transfert effectué / échoué : [montant] » sont désormais
// traduits partie par partie (chaque partie validée) : chacun garde SON statut et le montant.
{
  const done = NS.translate.translate("Transfert effectué : 25 000 FCFA.", { target: "eton" });
  const failed = NS.translate.translate("Transfert échoué : 25 000 FCFA.", { target: "eton" });
  const doneEton = dictionary.entries.find((e) => e.fr === "Transfert effectué").local.replace(/\s*[.!]+$/u, "");
  const failedEton = templates.find((t) => t.fr_pattern === "Transfert échoué").eton;
  assert.strictEqual(done.eton, doneEton + " : 25 000 FCFA.");
  assert.strictEqual(failed.eton, failedEton + " : 25 000 FCFA.");
  assert.ok(!done.eton.includes(failedEton) && !failed.eton.includes(doneEton), "inversion effectué / échoué");
}
{
  // « insuffisant » est validé (banque de messages) : sa propre traduction, exacte.
  // « suffisant » n'existe pas : jamais traduit, et surtout jamais pris pour « insuffisant ».
  const insufficient = NS.translate.translate("Votre solde est insuffisant.", { target: "eton" });
  const entry = dictionary.entries.find((e) => e.fr === "Votre solde est insuffisant.");
  if (entry && entry.statut === "valide") {
    assert.strictEqual(insufficient.source, "exact");
    assert.strictEqual(insufficient.eton, entry.local);
  } else {
    assert.strictEqual(insufficient.statut, "non_traduit");
  }
  const sufficient = NS.translate.translate("Votre solde est suffisant.", { target: "eton" });
  assert.strictEqual(sufficient.statut, "non_traduit");
  assert.strictEqual(sufficient.eton, null);
}

console.table(rows);
console.log("15 messages inédits vérifiés : aucune perte de valeur protégée ni inversion sur les paires piégées.");
