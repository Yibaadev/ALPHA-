"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const debugLines = [];
const runtime = vm.createContext({
  console: { debug: (...parts) => debugLines.push(parts.join(" ")) },
});
for (const file of [
  "src/protect.js",
  "src/confidence.js",
  "src/engine/templates.js",
  "src/engine/fuzzy.js",
  "src/engine/segments.js",
  "src/engine/rules.js",
  "src/translate.js",
]) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), runtime, { filename: file });
}

const NS = runtime.ALPHA;
const terms = require(path.join(root, "data", "critical_terms.json"));
const emptyDictionary = { meta: { names: [], ignore: [] }, entries: [] };
const emptyLayers = { criticalTerms: terms, templates: [], lexicon: [], rules: [] };
function init(dictionary = emptyDictionary, options = {}) {
  NS.translate.init(dictionary, { ...emptyLayers, ...options });
}
function text(value) {
  return NS.translate.translate(value, { target: "eton" });
}

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log("OK - " + name);
}

test("exact passe avant le gabarit", () => {
  init({
    meta: { names: [], ignore: [] },
    entries: [{ id: "exact", fr: "Solde", en: "", local: "TEST_EXACT", statut: "valide" }],
  }, {
    templates: [{ id: "same", fr_pattern: "Solde", eton: "TEST_TEMPLATE", statut: "valide", critique: false }],
  });
  const originalTemplateMatch = NS.templates.match;
  NS.templates.match = () => { throw new Error("un gabarit ne doit pas dépasser exact"); };
  try {
    const result = text("Solde");
    assert.strictEqual(result.source, "exact");
    assert.strictEqual(result.eton, "TEST_EXACT");
  } finally {
    NS.templates.match = originalTemplateMatch;
  }
});

test("gabarit validé restaure un montant", () => {
  init(emptyDictionary, {
    templates: [{
      id: "fixture_transfer",
      fr_pattern: "Transfert de [M1]",
      eton: "TEST_TEMPLATE [M1]",
      statut: "valide",
      critique: false,
    }],
  });
  const result = text("Transfert de 25 000 FCFA");
  assert.strictEqual(result.source, "template");
  assert.strictEqual(result.statut, "probable");
  assert.strictEqual(result.eton, "TEST_TEMPLATE 25 000 FCFA");
  assert.strictEqual(result.marqueurs_ok, true);
});

test("gabarit validé peut traiter une phrase critique marquée critique", () => {
  init(emptyDictionary, {
    templates: [{
      id: "fixture_failed_transfer",
      fr_pattern: "Transfert échoué [M1]",
      eton: "TEST_CRITICAL_TEMPLATE [M1]",
      statut: "valide",
      critique: true,
    }],
  });
  const result = text("Transfert échoué 250 FCFA");
  assert.strictEqual(result.source, "template");
  assert.strictEqual(result.eton, "TEST_CRITICAL_TEMPLATE 250 FCFA");
});

test("fuzzy corrige une faute simple avec le même montant", () => {
  init({
    meta: { names: [], ignore: [] },
    entries: [{
      id: "reference",
      fr: "Montant disponible [M1]",
      en: "",
      local: "TEST_FUZZY [M1]",
      statut: "valide",
    }],
  });
  const result = text("Montant disponble 25 000 FCFA");
  assert.strictEqual(result.source, "fuzzy");
  assert.strictEqual(result.statut, "probable");
  assert.strictEqual(result.eton, "TEST_FUZZY 25 000 FCFA");
});

test("segments précèdent les règles et gardent les mots inconnus", () => {
  init(emptyDictionary, {
    lexicon: [
      { fr: "bonjour", eton: "TEST_BONJOUR", pos: "n.", statut: "verifie" },
      { fr: "monde", eton: "TEST_MONDE", pos: "n.", statut: "verifie" },
    ],
    rules: [{
      id: "fixture_rule",
      description_fr: "fixture",
      pattern: { fr: "{verbe_fr} maintenant", eton: "{verbe_eton}gá now", verbe_fr: "bonjour" },
      example_fr: "bonjour maintenant",
      example_eton: "TEST_BONJOURgá now",
      statut: "verifie",
      verifie_par: "fixture",
      date: "2026-01-01",
    }],
  });
  const result = text("bonjour monde");
  assert.strictEqual(result.source, "segments");
  assert.strictEqual(result.eton, "TEST_BONJOUR TEST_MONDE");
});

test("règle validée est le repli après fuzzy et segments", () => {
  init(emptyDictionary, {
    lexicon: [{
      fr: "verbe alpha",
      eton: "ROOT_ALPHA",
      pos: "v.",
      statut: "verifie",
    }],
    rules: [{
      id: "fixture_rule",
      description_fr: "fixture",
      pattern: { fr: "{verbe_fr} maintenant", eton: "{verbe_eton}gá now", verbe_fr: "verbe alpha" },
      example_fr: "verbe alpha maintenant",
      example_eton: "ROOT_ALPHAgá now",
      statut: "verifie",
      verifie_par: "fixture",
      date: "2026-01-01",
    }],
  });
  const result = text("verbe alpha maintenant");
  assert.strictEqual(result.source, "regles");
  assert.strictEqual(result.statut, "probable");
  assert.strictEqual(result.eton, "ROOT_ALPHAgá now");
});

test("marqueur perdu par une couche entraîne le rejet", () => {
  init(emptyDictionary);
  NS.fuzzy.match = (original) => ({
    original, eton: "TEST_SANS_MONTANT", statut: "probable", source: "fuzzy",
    score: 0.99, marqueurs_ok: true, raisons: [],
  });
  const result = text("Information nouvelle 25 000 FCFA");
  assert.strictEqual(result.statut, "non_traduit");
  assert.strictEqual(result.eton, null);
  assert.strictEqual(result.marqueurs_ok, false);
});

test("un chiffre non protégé perdu entraîne aussi le rejet", () => {
  init(emptyDictionary);
  const result = NS.translate.validateIntegrity("Code 1234", "TEST_SANS_CHIFFRE");
  assert.strictEqual(result.ok, false);
});

test("effectué/échoué et suffisant/insuffisant sont bloqués", () => {
  init(emptyDictionary);
  let fuzzyCalls = 0;
  NS.fuzzy.match = () => { fuzzyCalls++; return null; };
  for (const original of [
    "Transfert effectué 25 000 FCFA",
    "Transfert échoué 25 000 FCFA",
    "Solde suffisant",
    "Solde insuffisant",
  ]) {
    const result = text(original);
    assert.strictEqual(result.statut, "non_traduit", original);
    assert.strictEqual(result.eton, null, original);
    assert.strictEqual(result.source, "aucune", original);
  }
  assert.strictEqual(fuzzyCalls, 0);
});

test("trace désactivée par défaut puis activable sans texte source", () => {
  init(emptyDictionary);
  debugLines.length = 0;
  text("Texte inédit ALPHA-SECRET");
  assert.strictEqual(debugLines.length, 0);
  NS.translate.setDebugTrace(true);
  text("Texte inédit ALPHA-SECRET");
  NS.translate.setDebugTrace(false);
  assert.ok(debugLines.length > 0);
  assert.ok(debugLines.every((line) => !line.includes("ALPHA-SECRET")));
});

console.log(passed + " tests cascade réussis.");
