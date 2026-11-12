#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const readline = require("readline/promises");
const { stdin, stdout } = require("process");

function option(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function load(file) {
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Array.isArray(parsed)) throw new Error("Le lexique doit être un tableau JSON.");
  return parsed;
}

function save(file, entries) {
  fs.writeFileSync(file, JSON.stringify(entries, null, 2) + "\n", "utf8");
}

function shuffle(items) {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

async function main() {
  const file = path.resolve(option("--file", "data/lexicon.json"));
  const count = Math.max(1, Number.parseInt(option("--count", "5"), 10) || 5);
  const entries = load(file);
  const todo = shuffle(entries.filter((entry) => entry.statut === "a_verifier")).slice(0, count);
  if (!todo.length) {
    console.log("Aucune entrée a_verifier dans " + file + ".");
    return;
  }

  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    console.log("Revue de " + todo.length + " entrée(s). Saisissez v pour marquer verifie, Entrée pour laisser en attente, q pour arrêter.\n");
    for (const [index, entry] of todo.entries()) {
      console.log((index + 1) + ". Français : " + entry.fr);
      console.log("   Éton     : " + entry.eton);
      console.log("   POS      : " + entry.pos + " | Classe : " + entry.classe + " | Source : " + entry.source);
      const answer = (await rl.question("Décision [v/Entrée/q] : ")).trim().toLowerCase();
      if (answer === "q") break;
      if (answer === "v") {
        if (typeof entry.fr !== "string" || !entry.fr.trim() || typeof entry.eton !== "string" || !entry.eton.trim()) {
          console.log("Entrée non validable : français ou éton manquant.\n");
          continue;
        }
        entry.statut = "verifie";
        save(file, entries);
        console.log("Statut enregistré : verifie.\n");
      } else {
        console.log("Entrée laissée en attente.\n");
      }
    }
  } finally {
    rl.close();
  }
}

main().catch((error) => {
  console.error("Revue impossible : " + error.message);
  process.exitCode = 1;
});
