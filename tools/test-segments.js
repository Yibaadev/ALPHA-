"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const context = vm.createContext({ console });
for (const file of ["src/protect.js", "src/engine/common.js", "src/engine/segments.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
}
const engine = context.ALPHA.segments;
const criticalTerms = require(path.join(root, "data", "critical_terms.json"));
const dictionary = require(path.join(root, "data", "dictionary.json"));
const lexicon = require(path.join(root, "data", "lexicon.json"));

engine.init(dictionary, lexicon, criticalTerms);
const realReference = engine.match("Solde disponible");
assert.strictEqual(realReference.statut, "probable");
assert.strictEqual(realReference.source, "segments");
assert.strictEqual(realReference.eton, "Mwàní ú nè", "les tons du dictionnaire validé sont préservés");

const verifiedDictionary = {
  meta: { names: [], ignore: [] },
  entries: [
    { id: "balance", fr: "solde", local: "TOKEN_SOLDE", statut: "valide" },
    { id: "available", fr: "disponible", local: "TOKEN_AVAILABLE", statut: "valide" },
    { id: "fee_short", fr: "frais", local: "TOKEN_FEE_SHORT", statut: "valide" },
    { id: "de", fr: "de", local: "TOKEN_DE", statut: "valide" },
    { id: "transfer", fr: "transfert", local: "TOKEN_TRANSFER", statut: "valide" },
    { id: "fee_long", fr: "frais de transfert", local: "TOKEN_FEE_LONG", statut: "valide" },
  ],
};
const pendingLexicon = [
  { fr: "maintenant", eton: "UNVERIFIED_TERM", statut: "a_verifier" },
];
engine.init(verifiedDictionary, pendingLexicon, criticalTerms);
const composed = engine.match("Solde disponible frais de transfert maintenant");
assert.strictEqual(composed.statut, "probable");
assert.strictEqual(composed.eton, "TOKEN_SOLDE TOKEN_AVAILABLE TOKEN_FEE_LONG maintenant");
assert.ok(Math.abs(composed.score - 5 / 6) < 0.00001);
assert.ok(composed.raisons.some((reason) => reason.includes("restent en français")));

const exactThreshold = engine.match("Solde disponible frais transfert inconnu");
assert.strictEqual(exactThreshold.statut, "probable", "une couverture exactement égale à 80 % est acceptée");
assert.strictEqual(exactThreshold.eton, "TOKEN_SOLDE TOKEN_AVAILABLE TOKEN_FEE_SHORT TOKEN_TRANSFER inconnu");
assert.strictEqual(exactThreshold.score, 0.8);

engine.init({ meta: {}, entries: [{ id: "balance", fr: "solde", local: "TOKEN_SOLDE", statut: "valide" }] }, [], criticalTerms);
const lowCoverage = engine.match("Solde complètement inconnu");
assert.strictEqual(lowCoverage.statut, "non_traduit");
assert.strictEqual(lowCoverage.eton, null);
assert.ok(Math.abs(lowCoverage.score - 1 / 3) < 0.00001);

engine.init({
  meta: {},
  entries: [
    { id: "transfer", fr: "transfert", local: "TOKEN_TRANSFER", statut: "valide" },
    { id: "failed", fr: "échoué", local: "TOKEN_FAILED", statut: "valide" },
  ],
}, [], criticalTerms);
const critical = engine.match("Transfert échoué");
assert.strictEqual(critical.statut, "non_traduit");
assert.strictEqual(critical.eton, null);
assert.ok(critical.raisons[0].includes("Phrase critique"));

engine.init({ meta: { names: ["Amina"] }, entries: [
  { id: "balance", fr: "solde", local: "Mwàní", statut: "valide" },
] }, [], criticalTerms);
const protectedAmount = engine.match("Solde : 25 000 FCFA");
assert.strictEqual(protectedAmount.statut, "probable");
assert.strictEqual(protectedAmount.eton, "Mwàní : 25 000 FCFA");
assert.strictEqual(protectedAmount.marqueurs_ok, true);

engine.init({ meta: {}, entries: [] }, [
  { fr: "maintenant", eton: "UNVERIFIED_TERM", statut: "a_verifier" },
], criticalTerms);
assert.strictEqual(engine.match("maintenant").statut, "non_traduit", "une entrée a_verifier ne doit jamais être utilisée");

engine.init({ meta: {}, entries: [] }, [
  { fr: "paiement", eton: "VERIFIED_TERM", statut: "verifie" },
], criticalTerms);
const reviewedLexicon = engine.match("paiement");
assert.strictEqual(reviewedLexicon.statut, "probable");
assert.strictEqual(reviewedLexicon.eton, "VERIFIED_TERM", "une entrée verifie peut être utilisée");

engine.init({ meta: {}, entries: [
  { id: "balance_a", fr: "solde", local: "TARGET_A", statut: "valide" },
  { id: "balance_b", fr: "Solde", local: "TARGET_B", statut: "verifie" },
] }, [], criticalTerms);
assert.strictEqual(engine.match("Solde").statut, "non_traduit", "des références conflictuelles sont écartées");

console.log("Segments : correspondance la plus longue, couverture 80 %, statut vérifié, phrase critique et intégrité validés.");
