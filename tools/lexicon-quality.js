#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const file = path.resolve(process.argv[2] || "data/lexicon.json");
const entries = JSON.parse(fs.readFileSync(file, "utf8"));
if (!Array.isArray(entries)) throw new Error("Le lexique doit être un tableau JSON.");

const requiredStrings = ["fr", "eton", "pos", "classe", "source", "statut"];
const malformed = [];
const duplicates = new Map();
let withoutDiacritics = 0;

for (const [index, entry] of entries.entries()) {
  const invalid = requiredStrings.filter((key) => typeof entry[key] !== "string");
  if (!entry.fr || !entry.fr.trim()) invalid.push("fr vide");
  if (!entry.eton || !entry.eton.trim()) invalid.push("eton vide");
  if (!entry.source || !entry.source.trim()) invalid.push("source vide");
  if (entry.statut !== "a_verifier" && entry.statut !== "verifie") invalid.push("statut invalide");
  if ([entry.fr, entry.eton].some((value) => typeof value === "string" && value.includes("\ufffd"))) {
    invalid.push("caractère de remplacement U+FFFD");
  }
  if (invalid.length) {
    malformed.push({ index: index + 1, invalid, statut: entry.statut });
  }
  const pair = JSON.stringify([entry.fr, entry.eton, entry.pos, entry.classe]);
  if (duplicates.has(pair)) duplicates.get(pair).push(index + 1);
  else duplicates.set(pair, [index + 1]);
  const normalized = String(entry.eton || "").normalize("NFD");
  if (normalized === normalized.replace(/\p{M}/gu, "")) withoutDiacritics++;
}

const duplicateGroups = [...duplicates.values()].filter((positions) => positions.length > 1);
console.log("Entrées : " + entries.length);
console.log("Doublons exacts (fr + éton + POS + classe) : " + duplicateGroups.length);
console.log("Entrées mal parsées / champs invalides : " + malformed.length);
console.log("Éton sans diacritique Unicode détectable : " + withoutDiacritics);
console.log("Le dernier indicateur est un signal de revue, pas une preuve d'erreur linguistique.");
if (duplicateGroups.length) console.log("Positions des doublons : " + JSON.stringify(duplicateGroups));
if (malformed.length) console.log("Entrées mal formées : " + JSON.stringify(malformed));
if (duplicateGroups.length || malformed.length) process.exitCode = 1;
