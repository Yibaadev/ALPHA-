// Exporte les textes éton validés à faire lire par OmniVoice (Google Colab).
// Sortie : docs/audio/eton-tts.jsonl, une ligne JSON par clip : {"id", "key", "text", "language_id"}.
// Lancer : node tools/export-eton-tts.js
//
// Repris : entrées du dictionnaire au statut « valide », avec un texte éton, sans valeur
// variable [M1] (un montant ou un nom change à chaque fois : il ne peut pas être enregistré
// à l'avance). Plus tard : textes éton du guide et du glossaire, une fois validés.
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
// Nom de fichier sans accent ni caractère spécial, unique (« réussie » devient « reussie »).
const usedFiles = new Set();
function fileNameFor(id) {
  const base = id.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9._]+/g, "_");
  let name = base;
  for (let n = 2; usedFiles.has(name); n++) name = base + "_" + n;
  usedFiles.add(name);
  return name;
}

const lines = [];
const skipped = [];
function add(id, text, origin) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  if (!value) return;
  if (/\[M\d+\]/.test(value)) {
    skipped.push(id + " (valeur variable)");
    return;
  }
  // « id » : nom du fichier audio ; « key » : identifiant d'origine dans les données d'ALPHA.
  lines.push({ id: fileNameFor(id), key: id, text: value, language_id: "eto", origin });
}

for (const entry of read("data/dictionary.json").entries || []) {
  if (entry.statut !== "valide") continue;
  add("dict." + entry.id, entry.local, "dictionary");
}
for (const screen of read("data/guide.json").screens || []) {
  if (!screen.local) continue;
  for (const part of ["where", "what", "how", "tip"]) {
    // Les {cles} sont des libellés variables : ces phrases seront découpées plus tard.
    if (screen.local[part] && !/\{\w+\}/.test(screen.local[part])) add("guide." + screen.id + "_" + part, screen.local[part], "guide");
  }
}
for (const entry of read("data/glossary.json").entries || []) {
  if (entry.local && entry.local.text) add("gloss." + entry.id, entry.local.term + ". " + entry.local.text, "glossary");
}

const outDir = path.join(root, "docs", "audio");
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, "eton-tts.jsonl");
fs.writeFileSync(out, lines.map((line) => JSON.stringify(line)).join("\n") + "\n");
console.log(lines.length + " texte(s) éton exporté(s) dans " + path.relative(root, out));
if (skipped.length) console.log("Ignoré(s) : " + skipped.join(", "));
