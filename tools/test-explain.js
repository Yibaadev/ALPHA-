// Tests de l'action « Expliquer » (src/explain.js) : glossaire vérifié, sans modèle d'IA.
// Lancer : node tools/test-explain.js
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const context = vm.createContext({ console });
vm.runInContext(fs.readFileSync(path.join(root, "src/explain.js"), "utf8"), context, { filename: "src/explain.js" });
const E = context.ALPHA.explain;
const glossary = JSON.parse(fs.readFileSync(path.join(root, "data/glossary.json"), "utf8"));
E.init(glossary);
const ids = (text) => Array.from(E.find(text), (entry) => entry.id);

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    console.error("ÉCHEC : " + name + "\n  " + e.message);
    process.exitCode = 1;
  }
}

test("glossaire bien formé : identifiants uniques, textes FR et EN présents", () => {
  const seen = new Set();
  for (const entry of glossary.entries) {
    assert.ok(!seen.has(entry.id), "identifiant en double : " + entry.id);
    seen.add(entry.id);
    for (const lang of ["fr", "en"]) {
      assert.ok(entry[lang] && entry[lang].term && entry[lang].text, entry.id + " sans texte " + lang);
      assert.ok(Array.isArray(entry.terms[lang]) && entry.terms[lang].length, entry.id + " sans terme " + lang);
    }
  }
});

test("aucune explication ne contient de chiffre (pas de montant ni de frais inventés)", () => {
  for (const entry of glossary.entries) {
    for (const lang of ["fr", "en"]) {
      // Seul l'exemple de pourcentage des frais est autorisé.
      const text = entry[lang].text.replace(/1[,.]5\s?%/, "");
      assert.ok(!/\d/.test(text), entry.id + " (" + lang + ") contient un chiffre : " + text);
    }
  }
});

test("termes du parcours de test reconnus, en français et en anglais", () => {
  assert.deepStrictEqual(ids("Solde disponible"), ["balance"]);
  assert.deepStrictEqual(ids("Available balance"), ["balance"]);
  assert.deepStrictEqual(ids("Frais de 1,5 % (min. 100 FCFA, max. 2 500 FCFA)"), ["fees"]);
  assert.deepStrictEqual(ids("Mobile Money"), ["mobile_money"]);
  assert.deepStrictEqual(ids("Référence"), ["reference"]);
});

test("le terme le plus long l'emporte", () => {
  assert.deepStrictEqual(ids("Total débité"), ["total_debit"]);
  assert.deepStrictEqual(ids("Solde après opération"), ["balance_after"]);
  assert.deepStrictEqual(ids("Total to debit"), ["total_debit"]);
});

test("insensible aux accents, à la casse et à l'apostrophe typographique", () => {
  assert.deepStrictEqual(ids("BENEFICIAIRE"), ["beneficiary"]);
  assert.deepStrictEqual(ids("Type d’opération"), ["operation_type"]);
});

test("mots entiers seulement : pas de faux positif au milieu d'un mot", () => {
  assert.deepStrictEqual(ids("Fraisier"), []);
  assert.deepStrictEqual(ids("pinceau"), []);
  assert.deepStrictEqual(ids("Bonjour Amina"), []);
});

test("plusieurs termes : dans l'ordre du texte, sans doublon, trois au plus", () => {
  assert.deepStrictEqual(ids("Ce bénéficiaire n'a jamais été utilisé sur ce compte."), ["beneficiary", "new_beneficiary"]);
  const r = E.explain("Montant, frais, total débité, référence et statut", "fr", "fr");
  assert.strictEqual(r.items.length, 3);
  assert.deepStrictEqual(Array.from(r.items, (i) => i.id), ["amount", "fees", "total_debit"]);
});

test("langue de l'explication : celle choisie, sinon celle de la page", () => {
  assert.strictEqual(E.explain("Frais", "en", "fr").lang, "en");
  assert.strictEqual(E.explain("Fee", "original", "en").lang, "en");
  assert.strictEqual(E.explain("Fee", "fr", "en").items[0].term, "Frais");
});

test("en éton : explication en français, signalée en attente de validation", () => {
  const r = E.explain("Solde", "local", "fr");
  assert.strictEqual(r.lang, "fr");
  assert.ok(/attente de validation/.test(r.note), r.note);
});

test("texte sans terme connu : aucune explication (le bouton n'apparaît pas)", () => {
  assert.strictEqual(E.explain("Bienvenue sur notre site", "fr", "fr"), null);
  assert.strictEqual(E.explain("", "fr", "fr"), null);
});

test("texte lu à voix haute : terme puis explication", () => {
  const r = E.explain("Reçu", "fr", "fr");
  assert.ok(r.speech.startsWith("Reçu. La preuve"), r.speech);
});

console.log(passed + " test(s) « Expliquer » réussi(s).");
