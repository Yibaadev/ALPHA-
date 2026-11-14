// Extrait du lexique les seules entrées utilisables par le moteur (statut « valide » ou « verifie »).
// Le lexique complet (data/lexicon.json, ~1,4 Mo, entrées « a_verifier ») reste un outil de travail :
// l'extension ne charge que data/lexicon-valide.json, beaucoup plus léger, dans chaque page.
//   node tools/lexicon-valide.js
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const SOURCE = path.join(root, "data", "lexicon.json");
const TARGET = path.join(root, "data", "lexicon-valide.json");

function usable(lexicon) {
  return (Array.isArray(lexicon) ? lexicon : []).filter((entry) => entry && (entry.statut === "valide" || entry.statut === "verifie"));
}

function render() {
  return JSON.stringify(usable(JSON.parse(fs.readFileSync(SOURCE, "utf8"))), null, 2) + "\n";
}

if (require.main === module) {
  const text = render();
  fs.writeFileSync(TARGET, text, "utf8");
  console.log(JSON.parse(text).length + " entrée(s) validée(s) -> data/lexicon-valide.json");
}

module.exports = { usable, render, TARGET };
