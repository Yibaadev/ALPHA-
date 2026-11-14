// Tests de la protection des valeurs et de la recherche dans le dictionnaire.
// Lancer : node tools/test.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");
const os = require("os");
const { execFileSync } = require("child_process");

const root = path.join(__dirname, "..");
const ctx = vm.createContext({ console });
for (const f of ["src/protect.js", "src/engine/language.js", "src/translate.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx, { filename: f });
}
const { protect: P, translate: T } = ctx.ALPHA;

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

const re = P.build(["Amina Ngo Bell", "Jean-Paul Mbarga", "Amina"]);
const masked = (s) => P.protect(s, re).masked;

// Protection des montants, coordonnées, références et noms connus.
const cases = [
  ["25 000 FCFA", "[M1]"],
  ["25 000 FCFA", "[M1]"],
  ["250000 FCFA", "[M1]"],
  ["0 FCFA", "[M1]"],
  ["−12 500 FCFA", "[M1]"],
  ["+180 000 FCFA", "[M1]"],
  ["Frais 0 FCFA", "Frais [M1]"],
  ["FCFA", "[M1]"],
  ["Numéro de compte : CM 001 2345 6789 01", "Numéro de compte : [M1]"],
  ["+237 6 99 12 34 56", "[M1]"],
  ["SAF-2026-TRI1LW", "[M1]"],
  ["SECURITY_001", "[M1]"],
  ["05 nov. 2026", "[M1]"],
  ["Nov 5, 2026", "[M1]"],
  ["05/11/2026", "[M1]"],
  ["Bonjour, Amina", "Bonjour, [M1]"],
  ["Bonjour, Amina Ngo Bell", "Bonjour, [M1]"],
  ["Total débité", "Total débité"],
  ["Aminata", "Aminata"],
];
for (const [input, expected] of cases) {
  test("protect " + JSON.stringify(input), () => assert.strictEqual(masked(input), expected));
}

test("deux valeurs dans un texte", () => {
  const r = P.protect("De Amina vers +237 6 99 12 34 56", re);
  assert.strictEqual(r.masked, "De [M1] vers [M2]");
  assert.deepStrictEqual(Array.from(r.values), ["Amina", "+237 6 99 12 34 56"]);
});
test("le nom propre reconnu est protégé quelle que soit sa casse", () => {
  const r = P.protect("Compte SAFINUM PAY", P.build(["Safinum Pay"]));
  assert.strictEqual(r.masked, "Compte [M1]");
  assert.strictEqual(r.values[0], "SAFINUM PAY");
});

// Restauration stricte : les marqueurs manquants ou répétés sont rejetés.
test("restore simple", () => assert.strictEqual(P.restore("Total : [M1]", ["25 000 FCFA"]), "Total : 25 000 FCFA"));
test("restore dans un autre ordre", () => assert.strictEqual(P.restore("[M2] puis [M1]", ["a", "b"]), "b puis a"));
test("restore refuse un marqueur manquant", () => assert.strictEqual(P.restore("sans marqueur", ["x"]), null));
test("restore refuse un marqueur répété", () => assert.strictEqual(P.restore("[M1] [M1]", ["x"]), null));
test("restore refuse un marqueur inconnu", () => assert.strictEqual(P.restore("[M3]", ["x"]), null));

// Recherche exacte, variantes et intégrité des valeurs du dictionnaire.
T.init({
  meta: { names: ["Amina Ngo Bell", "Jean-Paul Mbarga", "Amina", "Safinum Pay"], ignore: ["Alpha Pay", "Safinum Pay"] },
  entries: [
    { id: "a", fr: "Total débité", en: "Total debited", local: "LOC total", statut: "valide" },
    { id: "b", fr: "Numéro de compte : [M1]", en: "", local: "LOC compte [M1]", statut: "valide" },
    { id: "c", fr: "Solde", en: "", local: "" },
    { id: "d", fr: "Frais", en: "", local: "LOC frais sans marqueur [M1]", statut: "valide" },
    { id: "e", fr: "Total à débiter [M1]", en: "", local: "LOC sans marqueur", statut: "valide" },
  ],
});

test("traduction simple", () => assert.deepStrictEqual(T.analyse("Total débité", "local").text, "LOC total"));
test("majuscules et espaces ignorés", () => assert.strictEqual(T.analyse("  TOTAL   DÉBITÉ ", "local").text, "LOC total"));
test("texte anglais reconnu", () => assert.strictEqual(T.analyse("Total debited", "local").text, "LOC total"));
test("anglais vers français", () => assert.strictEqual(T.analyse("Total debited", "fr").text, "Total débité"));
test("valeur remise", () => {
  const r = T.analyse("Numéro de compte : CM 001 2345 6789 01", "local");
  assert.strictEqual(r.kind, "ok");
  assert.strictEqual(r.text, "LOC compte CM 001 2345 6789 01");
});
test("entrée sans traduction", () => assert.strictEqual(T.analyse("Solde", "local").kind, "pending"));
test("texte inconnu", () => assert.strictEqual(T.analyse("Un message nouveau", "local").kind, "unknown"));
test("valeur seule ignorée", () => assert.strictEqual(T.analyse("25 000 FCFA", "local").kind, "skip"));
test("chiffre seul ignoré", () => assert.strictEqual(T.analyse("3", "local").kind, "skip"));
test("texte ignoré par la configuration", () => assert.strictEqual(T.analyse("Alpha Pay", "local").kind, "skip"));
test("nom propre Safinum Pay ignoré", () => assert.strictEqual(T.analyse("Safinum Pay", "local").kind, "skip"));
test("marqueur oublié dans la traduction : refus", () => assert.strictEqual(T.analyse("Total à débiter 25 000 FCFA", "local").kind, "integrity"));
test("marqueur en trop dans la traduction : refus", () => assert.strictEqual(T.analyse("Frais", "local").kind, "integrity"));

test("la normalisation de comparaison ignore accents et ponctuation", () => {
  assert.strictEqual(T.normalizeForComparison("  ÉCHOUÉ,   25 FCFA! "), "echoue 25 fcfa");
});
test("le validateur rejette des marqueurs réordonnés", () => {
  const r = T.validateIntegrity("De 25 000 FCFA vers +237 6 99 12 34 56", "[M2] vers [M1]");
  assert.strictEqual(r.ok, false);
});
test("le validateur rejette la perte d'un chiffre non protégé", () => {
  const r = T.validateIntegrity("Code 1234", "Code vérifié");
  assert.strictEqual(r.ok, false);
});
test("une traduction locale sans statut valide est ignorée", () => {
  T.init({ entries: [{ id: "unverified", fr: "Solde", en: "", local: "texte local non validé" }] });
  const r = T.translate("Solde");
  assert.strictEqual(r.statut, "non_traduit");
  assert.strictEqual(r.eton, null);
});
test("sortie structurée inconnue conserve le texte original", () => {
  const unknown = "Une information nouvelle pour 25 000 FCFA.";
  const r = T.translate(unknown, { target: "eton" });
  assert.deepStrictEqual(Object.keys(r), ["original", "eton", "statut", "source", "score", "marqueurs_ok", "raisons"]);
  assert.strictEqual(r.original, unknown);
  assert.strictEqual(r.eton, null);
  assert.strictEqual(r.statut, "non_traduit");
  assert.strictEqual(r.source, "aucune");
  assert.strictEqual(r.score, 0);
  assert.strictEqual(r.marqueurs_ok, true);
  assert.ok(Array.isArray(r.raisons));
});
test("un marqueur manquant rejette la traduction structurée", () => {
  T.init({ entries: [{
    id: "broken", fr: "Total à débiter [M1]", en: "",
    local: "Mwàní sans montant", statut: "valide",
  }] });
  const r = T.translate("Total à débiter 25 000 FCFA");
  assert.strictEqual(r.statut, "non_traduit");
  assert.strictEqual(r.eton, null);
  assert.strictEqual(r.marqueurs_ok, false);
});

// Les 57 traductions existantes sont le jeu de référence de cette étape.
const dictionary = require(path.join(root, "data", "dictionary.json"));
T.init(dictionary);
test("les 60 phrases validées gardent exactement leur traduction", () => {
  const entries = dictionary.entries.filter((entry) => entry.local && entry.local.trim());
  assert.ok(entries.length >= 57);
  for (const entry of entries) {
    const markers = entry.fr.match(/\[M\d+\]/g) || [];
    const values = markers.map(() => "25 000 FCFA");
    let index = 0;
    const original = entry.fr.replace(/\[M\d+\]/g, () => values[index++]);
    const expected = P.restore(entry.local, values);
    const result = T.translate(original, { target: "eton" });
    assert.strictEqual(entry.statut, "valide", entry.id + " doit porter le statut valide");
    assert.strictEqual(result.statut, "valide", entry.id);
    assert.strictEqual(result.source, "exact", entry.id);
    assert.strictEqual(result.score, 1, entry.id);
    assert.strictEqual(result.eton, expected, entry.id);
    assert.strictEqual(result.marqueurs_ok, true, entry.id);
    assert.ok(Array.isArray(result.raisons), entry.id);
  }
});
test("Compte Safinum garde le nom propre", () => {
  const result = T.translate("Compte Safinum", { target: "eton" });
  assert.strictEqual(result.statut, "valide");
  assert.strictEqual(result.eton, "Kɔ̂nt Safinum");
});
test("Safinum Pay reste intact dans le bandeau traduit", () => {
  const original = "Safinum Pay — environnement de démonstration. Ne saisissez aucune donnée personnelle réelle.";
  const result = T.translate(original, { target: "eton" });
  assert.strictEqual(result.statut, "valide");
  assert.ok(result.eton.startsWith("Safinum Pay —"));
});
test("un changement CSV retire le statut valide jusqu’à révision", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "alpha-csv-"));
  try {
    for (const dir of ["tools", "data", "docs"]) fs.mkdirSync(path.join(tempRoot, dir));
    fs.copyFileSync(path.join(root, "tools", "csv.js"), path.join(tempRoot, "tools", "csv.js"));
    fs.writeFileSync(path.join(tempRoot, "data", "dictionary.json"), JSON.stringify({
      meta: {},
      entries: [{ id: "balance", screen: "Étapes", fr: "Solde", en: "Balance", local: "Ancien texte", note: "", statut: "valide" }],
    }), "utf8");
    const csv = "id;ecran;francais;anglais;langue_locale;note\r\nbalance;Étapes;Solde;Balance;Nouveau texte;\r\n";
    const csvPath = path.join(tempRoot, "docs", "dictionnaire.csv");
    fs.writeFileSync(csvPath, csv, "utf8");
    execFileSync(process.execPath, [path.join(tempRoot, "tools", "csv.js"), "import", csvPath], { cwd: tempRoot });
    const imported = JSON.parse(fs.readFileSync(path.join(tempRoot, "data", "dictionary.json"), "utf8"));
    assert.strictEqual(imported.entries[0].local, "Nouveau texte");
    assert.strictEqual(imported.entries[0].statut, "a_verifier");
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

console.log(passed + " test(s) réussi(s)" + (process.exitCode ? ", des échecs ci-dessus." : "."));
