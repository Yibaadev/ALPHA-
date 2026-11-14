// Banque de messages (contenu inédit) : présente en français et en anglais, éton affiché seulement
// une fois validé par le locuteur, valeurs protégées, point final facultatif.
// Lancer : node tools/test-bank-eton.js
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const bank = require("./bank-eton.js");

const root = path.join(__dirname, "..");
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const engineFiles = ["src/protect.js", "src/confidence.js", "src/engine/common.js", "src/engine/templates.js",
  "src/engine/fuzzy.js", "src/engine/segments.js", "src/engine/rules.js", "src/engine/language.js", "src/translate.js"];

// Moteur chargé avec un dictionnaire donné (copie modifiable).
function engine(dictionary) {
  const context = vm.createContext({ console });
  for (const file of engineFiles) vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
  context.ALPHA.translate.init(dictionary, {
    criticalTerms: read("data/critical_terms.json"), templates: read("data/templates.json"),
    lexicon: [], rules: read("data/rules.json"),
  });
  return context.ALPHA.translate;
}

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

const dictionary = read("data/dictionary.json");
const source = read("docs/traduction/banque-messages.json").messages;

test("chaque message de la banque est dans le dictionnaire, français et anglais, marqueurs identiques", () => {
  const byId = new Map(dictionary.entries.map((e) => [e.id, e]));
  const keys = new Map(dictionary.entries.map((e) => [bank.key(e.fr), e.id]));
  for (const message of source) {
    const entry = byId.get("bank_" + message.id) || byId.get(keys.get(bank.key(message.fr)));
    assert.ok(entry, "absent : " + message.id);
    assert.strictEqual(bank.markers(message.en), bank.markers(message.fr), "anglais : " + message.id);
  }
});

test("éton non validé : jamais affiché (le message reste en français)", () => {
  const copy = JSON.parse(JSON.stringify(dictionary));
  const entry = copy.entries.find((e) => e.id === "bank_statut_transfert_annule_montant");
  entry.local = "ETO nlóm [M1] ETO";
  entry.statut = "a_verifier";
  const result = engine(copy).translate("Votre transfert de 15 000 FCFA a été annulé.", { target: "eton" });
  assert.strictEqual(result.statut, "non_traduit");
});

test("éton validé : message nouveau traduit, montant intact, avec ou sans point final", () => {
  const copy = JSON.parse(JSON.stringify(dictionary));
  const entry = copy.entries.find((e) => e.id === "bank_statut_transfert_annule_montant");
  entry.local = "ETO nlóm [M1] ETO.";
  entry.statut = "valide";
  const T = engine(copy);
  for (const text of ["Votre transfert de 15 000 FCFA a été annulé.", "Votre transfert de 15 000 FCFA a été annulé"]) {
    const result = T.translate(text, { target: "eton" });
    assert.strictEqual(result.statut, "valide", text);
    assert.strictEqual(result.eton, "ETO nlóm 15 000 FCFA ETO.");
  }
});

test("nom inconnu reconnu comme valeur : « Le bénéficiaire Paul Essomba a bien reçu 10 000 FCFA. »", () => {
  const copy = JSON.parse(JSON.stringify(dictionary));
  const entry = copy.entries.find((e) => e.id === "bank_beneficiaire_nom_a_recu");
  entry.local = "ETO [M1] ETO [M2].";
  entry.statut = "valide";
  const result = engine(copy).translate("Le bénéficiaire Paul Essomba a bien reçu 10 000 FCFA.", { target: "eton" });
  assert.strictEqual(result.eton, "ETO Paul Essomba ETO 10 000 FCFA.");
});

test("le point final facultatif ne mélange pas deux phrases différentes", () => {
  const T = engine(JSON.parse(JSON.stringify(dictionary)));
  // « Paiement refusé » existe ; « Paiement » seul ne doit pas être pris pour lui.
  assert.notStrictEqual(T.translate("Paiement", { target: "eton" }).source, "exact");
});

test("aucune traduction éton de la banque sans statut", () => {
  for (const e of dictionary.entries.filter((x) => x.id.startsWith("bank_"))) {
    assert.ok(["valide", "a_verifier"].includes(e.statut), e.id);
    if (e.local) assert.strictEqual(bank.markers(e.local), bank.markers(e.fr), e.id);
  }
});

console.log(passed + " test(s) banque de messages réussi(s) — " + source.length + " messages.");
