"use strict";

const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "data", "rules.json");
const rules = JSON.parse(fs.readFileSync(file, "utf8"));
if (!Array.isArray(rules)) throw new Error("rules.json doit être un tableau JSON.");

for (const rule of rules) {
  console.log("--- " + rule.id + " [" + rule.statut + "] ---");
  console.log("Règle : " + rule.description_fr);
  console.log("Patron : " + JSON.stringify(rule.pattern));
  console.log("Français : " + (rule.example_fr == null ? "(non fourni)" : rule.example_fr));
  console.log("Éton : " + (rule.example_eton == null ? "(non fourni)" : rule.example_eton));
  console.log("Vérifié par : " + (rule.verifie_par || "(personne)") + " | Date : " + (rule.date || "(non définie)"));
}
