"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const context = vm.createContext({ console });
vm.runInContext(
  fs.readFileSync(path.join(__dirname, "..", "src", "engine", "common.js"), "utf8"),
  context,
  { filename: "src/engine/common.js" }
);

const common = context.ALPHA.engineCommon;
assert.strictEqual(common.normalizeForComparison("  ÉCHOUÉ, [M1] : 25 000 FCFA! "), "echoue marker1 25 000 fcfa");
assert.deepStrictEqual(Array.from(common.markerTokens("A [M1] puis [M2]")), ["[M1]", "[M2]"]);
assert.deepStrictEqual(Array.from(common.numericTokens("[M1] 25 000,50 et 04")), ["25", "000,50", "04"]);
assert.strictEqual(common.sameArray(["a", "b"], ["a", "b"]), true);
assert.strictEqual(common.sameArray(["a"], ["b"]), false);

const terms = common.normalizeCriticalTerms({ categories: { security: ["code secret", "   "], empty: "invalid" } });
assert.deepStrictEqual(JSON.parse(JSON.stringify(terms)), [{ category: "security", term: "code secret" }]);
assert.strictEqual(common.containsCriticalTerm("Ne partagez pas le code secret.", terms), true);
assert.strictEqual(common.containsCriticalTerm("Le code est valide.", terms), false);

console.log("Utilitaires moteur : normalisation, signatures et termes critiques vérifiés.");
