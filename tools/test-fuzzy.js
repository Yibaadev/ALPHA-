"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const context = vm.createContext({ console });
for (const file of ["src/protect.js", "src/engine/fuzzy.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
}
const engine = context.ALPHA.fuzzy;
const dictionary = require(path.join(root, "data", "dictionary.json"));
const criticalTerms = require(path.join(root, "data", "critical_terms.json"));
engine.init({ entries: [{ id: "status", fr: "Transfert effectué", local: "TARGET", statut: "valide" }] }, null);
assert.strictEqual(engine.match("Transfert effectué").statut, "non_traduit", "sans liste critique le fuzzy doit se désactiver");
engine.init(dictionary, criticalTerms);

const reference = "Choisissez le type de transfert et le montant. Les frais sont calculés automatiquement.";
const typo = engine.match("Choisissez le type de transfert et le montant. Les frais sont calculés automatiqument.");
assert.strictEqual(typo.statut, "probable");
assert.strictEqual(typo.source, "fuzzy");
assert.strictEqual(typo.eton, dictionary.entries.find((entry) => entry.fr === reference).local);
assert.ok(typo.score >= 0.90, "la faute simple doit dépasser le seuil par défaut");
assert.ok(typo.raisons.some((reason) => reason.includes(reference)));
assert.strictEqual(engine.match("Choisissez le type de transfert et le montant. Les frais sont calculés automatiqument.", { threshold: 0.99 }).statut, "non_traduit");

function fixture(id, fr, local) {
  return { id, fr, local, statut: "valide" };
}

const outcomes = [
  fixture("status_success", "Transfert effectué", "TARGET_SUCCESS"),
  fixture("status_failure", "Transfert échoué", "TARGET_FAILURE"),
];
engine.init({ entries: outcomes }, criticalTerms);
const success = engine.match("Transfert effectué");
const failure = engine.match("Transfert échoué");
assert.strictEqual(success.statut, "non_traduit");
assert.strictEqual(failure.statut, "non_traduit");
assert.notStrictEqual(success.eton, "TARGET_FAILURE");
assert.notStrictEqual(failure.eton, "TARGET_SUCCESS");

const balances = [
  fixture("balance_sufficient", "Votre solde est suffisant", "TARGET_SUFFICIENT"),
  fixture("balance_insufficient", "Votre solde est insuffisant", "TARGET_INSUFFICIENT"),
];
engine.init({ entries: balances }, criticalTerms);
const sufficient = engine.match("Votre solde est suffisant");
const insufficient = engine.match("Votre solde est insuffisant");
assert.strictEqual(sufficient.statut, "non_traduit");
assert.strictEqual(insufficient.statut, "non_traduit");
assert.notStrictEqual(sufficient.eton, "TARGET_INSUFFICIENT");
assert.notStrictEqual(insufficient.eton, "TARGET_SUFFICIENT");

engine.init({ entries: [fixture("warning", "Ne partagez jamais votre code secret", "TARGET_WARNING")] }, criticalTerms);
const unknownCritical = engine.match("Ne transmettez jamais votre code secret par message");
assert.strictEqual(unknownCritical.statut, "non_traduit");
assert.strictEqual(unknownCritical.eton, null);
assert.ok(unknownCritical.raisons[0].includes("Phrase critique"));

engine.init({
  meta: { names: ["Amina"] },
  entries: [fixture("transfer", "Transfert de [M1] vers [M2]", "TARGET [M1] THEN [M2]")],
}, criticalTerms);
const protectedTransfer = engine.match("Transfert de 25 000 FCFA vers +237 6 99 12 34 56");
assert.strictEqual(protectedTransfer.statut, "probable");
assert.strictEqual(protectedTransfer.eton, "TARGET 25 000 FCFA THEN +237 6 99 12 34 56");
assert.strictEqual(protectedTransfer.marqueurs_ok, true);

engine.init({
  meta: { names: ["Amina"] },
  entries: [fixture("wrong_order", "Transfert de [M1] vers [M2]", "TARGET [M2] THEN [M1]")],
}, criticalTerms);
assert.strictEqual(engine.match("Transfert de Amina vers +237 6 99 12 34 56").statut, "non_traduit");

engine.init({ entries: [fixture("year", "Expiration 2025", "TARGET 2025")] }, criticalTerms);
assert.strictEqual(engine.match("Expiration 2026").statut, "non_traduit", "les chiffres fixes ne sont pas interchangeables");

engine.init({
  entries: [
    fixture("ambiguous_a", "abcdeXXXXX", "TARGET_A"),
    fixture("ambiguous_b", "YYYYYfghij", "TARGET_B"),
  ],
}, criticalTerms);
const ambiguous = engine.match("abcdefghij", {
  threshold: 0.45,
  ambiguityMargin: 0.01,
  referenceSimilarityThreshold: 0.85,
});
assert.strictEqual(ambiguous.statut, "non_traduit");
assert.ok(ambiguous.raisons[0].includes("Ambiguïté"));

console.log("Fuzzy : faute simple, seuil configurable, garde-fous critiques, marqueurs/chiffres et ambiguïté validés.");
