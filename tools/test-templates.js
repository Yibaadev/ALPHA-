"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const context = vm.createContext({ console });
vm.runInContext(fs.readFileSync(path.join(root, "src", "engine", "templates.js"), "utf8"), context);
const engine = context.ALPHA.templates;

function fixture(fr_pattern, eton, statut = "valide") {
  return { id: "fixture", fr_pattern, eton, statut };
}

const one = engine.matchTemplate("Solde : [M7]", fixture("Solde : [M1]", "CIBLE [M1]"));
assert.strictEqual(one.eton, "CIBLE [M7]");
assert.strictEqual(one.marqueurs_ok, true);

const two = engine.matchTemplate(
  "Transfert de [M8] vers [M3]",
  fixture("Transfert de [M1] vers [M2]", "CIBLE [M1] PUIS [M2]")
);
assert.strictEqual(two.eton, "CIBLE [M8] PUIS [M3]");
assert.deepStrictEqual(Array.from(engine.markerTokens(two.eton)), ["[M8]", "[M3]"]);

const three = engine.matchTemplate(
  "Montant [M5], frais [M2], total [M9]",
  fixture("Montant [M1], frais [M2], total [M3]", "CIBLE [M1] / [M2] / [M3]")
);
assert.strictEqual(three.eton, "CIBLE [M5] / [M2] / [M9]");

assert.strictEqual(engine.matchTemplate("Solde : [M1]", fixture("Solde : [M1]", "CIBLE [M1]", "a_verifier")), null);
assert.strictEqual(engine.matchTemplate("Solde : [M1]", fixture("Solde : [M1]", null)), null);
assert.strictEqual(engine.matchTemplate("Solde : [M1] [M2]", fixture("Solde : [M1]", "CIBLE [M1]")), null);
assert.strictEqual(engine.matchTemplate("Solde : [M1]", fixture("Solde : [M1]", "CIBLE")), null);
assert.strictEqual(engine.matchTemplate("Solde : [M1]", fixture("Solde [M1]", "CIBLE [M1]")), null);

const data = JSON.parse(fs.readFileSync(path.join(root, "data", "templates.json"), "utf8"));
assert.ok(data.length >= 20, "les parcours financiers doivent avoir des gabarits français");
const ids = new Set();
for (const template of data) {
  assert.ok(!ids.has(template.id), "id de gabarit unique");
  ids.add(template.id);
  assert.strictEqual(template.statut, "valide", "le gabarit doit être validé");
  assert.ok(typeof template.eton === "string" && template.eton.trim().length > 0, "la traduction Eton doit être renseignée");
  assert.ok(typeof template.critique === "boolean");
  assert.ok(["solde", "frais", "transfert", "recapitulatif", "erreur", "securite"].includes(template.categorie));

  const frMarkers = (template.fr_pattern.match(/\[M\d+\]/g) || []).sort().join(",");
  const etonMarkers = (template.eton.match(/\[M\d+\]/g) || []).sort().join(",");
  assert.strictEqual(etonMarkers, frMarkers, `les marqueurs de ${template.id} doivent correspondre (${frMarkers} attendu, ${etonMarkers} trouvé)`);
}

const testMatch = engine.match("Solde disponible : [M1]", data);
assert.ok(testMatch, "les gabarits validés doivent matcher avec succès");
assert.strictEqual(testMatch.eton, "Mwàní àlígì á kɔ̂nt : [M1]");

console.log("Gabarits : validation des champs, intégrité des marqueurs et appariement réussis.");
