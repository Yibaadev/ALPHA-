// Tests de la protection des valeurs et de la recherche dans le dictionnaire.
// Lancer : node tools/test.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const root = path.join(__dirname, "..");
const ctx = vm.createContext({ console });
for (const f of ["src/protect.js", "src/translate.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx, { filename: f });
}
const { protect: P, translate: T } = ctx.SAFINUM;

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

// --- valeurs protégées ---
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

// --- remise des valeurs ---
test("restore simple", () => assert.strictEqual(P.restore("Total : [M1]", ["25 000 FCFA"]), "Total : 25 000 FCFA"));
test("restore dans un autre ordre", () => assert.strictEqual(P.restore("[M2] puis [M1]", ["a", "b"]), "b puis a"));
test("restore refuse un marqueur manquant", () => assert.strictEqual(P.restore("sans marqueur", ["x"]), null));
test("restore refuse un marqueur répété", () => assert.strictEqual(P.restore("[M1] [M1]", ["x"]), null));
test("restore refuse un marqueur inconnu", () => assert.strictEqual(P.restore("[M3]", ["x"]), null));

// --- dictionnaire ---
T.init({
  meta: { names: ["Amina Ngo Bell", "Jean-Paul Mbarga", "Amina"], ignore: ["Safinum Pay"] },
  entries: [
    { id: "a", fr: "Total débité", en: "Total debited", local: "LOC total" },
    { id: "b", fr: "Numéro de compte : [M1]", en: "", local: "LOC compte [M1]" },
    { id: "c", fr: "Solde", en: "", local: "" },
    { id: "d", fr: "Frais", en: "", local: "LOC frais sans marqueur [M1]" },
    { id: "e", fr: "Total à débiter [M1]", en: "", local: "LOC sans marqueur" },
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
test("texte ignoré par la configuration", () => assert.strictEqual(T.analyse("Safinum Pay", "local").kind, "skip"));
test("marqueur oublié dans la traduction : refus", () => assert.strictEqual(T.analyse("Total à débiter 25 000 FCFA", "local").kind, "integrity"));
test("marqueur en trop dans la traduction : refus", () => assert.strictEqual(T.analyse("Frais", "local").kind, "integrity"));

console.log(passed + " test(s) réussi(s)" + (process.exitCode ? ", des échecs ci-dessus." : "."));
