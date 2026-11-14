"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const context = vm.createContext({ console });
for (const file of ["src/protect.js", "src/engine/common.js", "src/engine/rules.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
}
const engine = context.ALPHA.rules;
const rules = require(path.join(root, "data", "rules.json"));
const criticalTerms = require(path.join(root, "data", "critical_terms.json"));

assert.strictEqual(rules.length, 6);
for (const rule of rules) {
  assert.strictEqual(rule.statut, "a_verifier");
  assert.strictEqual(rule.verifie_par, null);
  assert.strictEqual(rule.date, null);
  assert.ok(Object.hasOwn(rule, "pattern"));
  assert.ok(Object.hasOwn(rule, "example_fr"));
  assert.ok(Object.hasOwn(rule, "example_eton"));
}
engine.init(rules, [], criticalTerms);
assert.strictEqual(engine.match("vérifiez").statut, "non_traduit", "une règle a_verifier n'est jamais appliquée");

const validatedRule = {
  id: "fixture_imperatif_pluriel",
  description_fr: "fixture de test",
  pattern: { fr: "vérifiez", eton: "{verbe_eton}gá", verbe_fr: "vérifier" },
  example_fr: "vérifiez",
  example_eton: "cázgá",
  statut: "verifie",
  verifie_par: "fixture",
  date: "2026-01-01",
};
const verifiedVerb = { fr: "vérifier", eton: "cáz", pos: "v.", statut: "verifie" };
engine.init([validatedRule], [verifiedVerb], criticalTerms);
const applied = engine.match("VÉRIFIEZ");
assert.strictEqual(applied.statut, "probable");
assert.strictEqual(applied.source, "regles");
assert.strictEqual(applied.eton, "cázgá");
assert.strictEqual(applied.marqueurs_ok, true);

const amountRule = {
  ...validatedRule,
  id: "fixture_imperatif_avec_montant",
  pattern: { fr: "vérifiez [M1]", eton: "{verbe_eton}gá [M1]", verbe_fr: "vérifier" },
  example_fr: "vérifiez [M1]",
  example_eton: "cázgá [M1]",
};
engine.init([amountRule], [verifiedVerb], criticalTerms);
const protectedAmount = engine.match("vérifiez 25 000 FCFA");
assert.strictEqual(protectedAmount.statut, "probable");
assert.strictEqual(protectedAmount.eton, "cázgá 25 000 FCFA");
assert.strictEqual(protectedAmount.marqueurs_ok, true);

const genericRule = {
  id: "fixture_generic",
  description_fr: "fixture structure générique",
  pattern: { fr: "{verbe_fr}", eton: "{verbe_eton}_SUFFIX", verbe_fr: "{verbe_fr}" },
  example_fr: "verb_alpha",
  example_eton: "ROOT_ALPHA_SUFFIX",
  statut: "verifie",
  verifie_par: "fixture",
  date: "2026-01-01",
};
engine.init([genericRule], [
  { fr: "verb_alpha", eton: "ROOT_ALPHA", pos: "v.", statut: "verifie" },
  { fr: "verb_beta", eton: "ROOT_BETA", pos: "v.", statut: "verifie" },
], criticalTerms);
assert.strictEqual(engine.match("verb_beta").eton, "ROOT_BETA_SUFFIX", "le patron réutilise les verbes vérifiés du lexique");

engine.init([validatedRule], [
  { ...verifiedVerb, statut: "a_verifier" },
], criticalTerms);
assert.strictEqual(engine.match("vérifiez").statut, "non_traduit", "un verbe non vérifié est ignoré");

engine.init([validatedRule], [verifiedVerb], criticalTerms);
const critical = engine.match("Transfert échoué");
assert.strictEqual(critical.statut, "non_traduit");
assert.strictEqual(critical.eton, null);

console.log("Règles : a_verifier ignorée, règle vérifiée contrôlée par le lexique, diacritiques préservés et phrase critique refusée.");
