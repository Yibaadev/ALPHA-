"use strict";

const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "data", "templates.json");
const templates = JSON.parse(fs.readFileSync(file, "utf8"));
if (!Array.isArray(templates)) throw new Error("templates.json doit être un tableau JSON.");

const todo = templates.filter((template) => template.statut !== "valide" || !template.eton);
if (!todo.length) {
  console.log("Aucun gabarit en attente.");
} else {
  console.log(todo.length + " gabarit(s) en attente de traduction et de validation Eton :\n");
  for (const template of todo) {
    console.log("- " + template.id + " [" + template.categorie + (template.critique ? ", critique" : "") + "]");
    console.log("  " + template.fr_pattern);
  }
}
