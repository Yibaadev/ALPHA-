"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.join(__dirname, "..");
const file = path.join(root, "data", "lexicon.json");
const entries = JSON.parse(fs.readFileSync(file, "utf8"));
assert.ok(Array.isArray(entries), "lexicon.json doit contenir un tableau");

const seen = new Set();
for (const entry of entries) {
  for (const key of ["fr", "eton", "pos", "classe", "source", "statut"]) {
    assert.strictEqual(typeof entry[key], "string", "champ texte requis : " + key);
  }
  assert.ok(entry.fr.trim(), "fr ne doit pas être vide");
  assert.ok(entry.eton.trim(), "eton ne doit pas être vide");
  const key = JSON.stringify([entry.fr, entry.eton, entry.pos, entry.classe]);
  assert.ok(!seen.has(key), "doublon exact : " + key);
  seen.add(key);
  assert.ok(["a_verifier", "verifie"].includes(entry.statut), "statut de lexique reconnu");
}

// Vérifie le round-trip de tons/diacritiques avec une valeur déjà présente dans le dictionnaire validé.
const dictionary = require(path.join(root, "data", "dictionary.json"));
const sample = dictionary.entries.find((entry) => typeof entry.local === "string" && entry.local.trim());
assert.ok(sample, "une valeur Eton de référence doit être disponible pour le test de préservation");
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "safinum-lexicon-"));
try {
  const tempFile = path.join(tempDir, "lexicon.json");
  const fixture = [{ fr: "fixture de test", eton: sample.local, pos: "", classe: "", source: "fixture temporaire", statut: "a_verifier" }];
  fs.writeFileSync(tempFile, JSON.stringify(fixture, null, 2), "utf8");
  execFileSync(process.execPath, [path.join(root, "tools", "review-lexicon.js"), "--file", tempFile, "--count", "1"], { input: "v\n" });
  const reviewed = JSON.parse(fs.readFileSync(tempFile, "utf8"));
  assert.strictEqual(reviewed[0].eton, sample.local, "les tons/diacritiques doivent rester identiques");
  assert.strictEqual(reviewed[0].statut, "verifie");
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

console.log("Lexique : JSON chargé, doublons contrôlés, tons/diacritiques préservés.");
