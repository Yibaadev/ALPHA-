// Fichier d'extension à soumettre : moins de 10 Mo, rien d'inutile, lexique allégé à jour.
// Lancer : node tests/package.test.js
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { listFiles, sizeOf, MAX_BYTES, EXT } = require("../scripts/build/package.js");
const lexicon = require("../scripts/build/lexicon-valide.js");

const files = listFiles();

assert.ok(files.includes("manifest.json"), "le manifeste doit être à la racine du paquet");
assert.ok(files.every((f) => fs.existsSync(path.join(EXT, f))), "fichier de l'extension introuvable");
assert.ok(!files.some((f) => /^(docs|content|scripts|tests|dist|node_modules|\.git)\//.test(f)), "documentation ou outils dans le paquet");
assert.ok(!files.some((f) => /(^|\/)lexicon\.json$/.test(f)), "le lexique complet (1,4 Mo, non validé) ne doit pas être livré");
// Comparaison du contenu (pas des octets) : git peut convertir les fins de ligne au clonage.
assert.deepStrictEqual(JSON.parse(fs.readFileSync(lexicon.TARGET, "utf8")), JSON.parse(lexicon.render()),
  "extension/data/lexicon-valide.json n'est pas à jour : lancez npm run package");
const bytes = sizeOf(files);
// Le zip est un peu plus petit que la somme des fichiers : si celle-ci passe, le zip passe.
assert.ok(bytes < MAX_BYTES, "paquet trop lourd : " + (bytes / 1048576).toFixed(2) + " Mo (limite 10 Mo)");
console.log("Paquet : " + files.length + " fichiers, " + (bytes / 1048576).toFixed(2) + " Mo (limite 10 Mo).");
