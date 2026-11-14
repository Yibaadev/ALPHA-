// Fichier d'extension à soumettre : moins de 10 Mo, rien d'inutile, lexique allégé à jour.
// Lancer : node tools/test-package.js
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { listFiles, sizeOf, MAX_BYTES } = require("./package.js");
const lexicon = require("./lexicon-valide.js");

const root = path.join(__dirname, "..");
const files = listFiles();

assert.ok(files.every((f) => fs.existsSync(path.join(root, f))), "fichier de l'extension introuvable");
assert.ok(!files.some((f) => /^(docs|tools|tests|dist|node_modules|\.git)\//.test(f)), "documentation ou outils dans le paquet");
assert.ok(!files.includes("data/lexicon.json"), "le lexique complet (1,4 Mo, non validé) ne doit pas être livré");
assert.strictEqual(fs.readFileSync(lexicon.TARGET, "utf8"), lexicon.render(),
  "data/lexicon-valide.json n'est pas à jour : lancez node tools/lexicon-valide.js");
const bytes = sizeOf(files);
// Le zip est un peu plus petit que la somme des fichiers : si celle-ci passe, le zip passe.
assert.ok(bytes < MAX_BYTES, "paquet trop lourd : " + (bytes / 1048576).toFixed(2) + " Mo (limite 10 Mo)");
console.log("Paquet : " + files.length + " fichiers, " + (bytes / 1048576).toFixed(2) + " Mo (limite 10 Mo).");
