// Exporte les textes éton validés à faire lire par OmniVoice (Google Colab).
// Sortie : docs/audio/eton-tts.jsonl, une ligne JSON par clip :
//   {"id", "key", "text", "language_id", "origin", "regenerer"?}
// Lancer : node tools/export-eton-tts.js            (textes validés seulement)
//          node tools/export-eton-tts.js --brouillons (ajoute les traductions encore à vérifier)
//
// Repris :
//  - dictionnaire : entrées « valide » sans valeur variable [M1] (un montant ou un nom change à chaque
//    fois : il ne peut pas être enregistré à l'avance) ;
//  - guide : chaque phrase des écrans connus, avec les noms de boutons éton du dictionnaire à la place
//    des {cles} (c'est exactement ce que le guide affiche sur la page) ; conseils d'alerte ;
//  - glossaire « Expliquer » : terme et définition, en deux clips.
// « regenerer » : le texte a changé depuis les clips actuels (data/audio/eton/omnivoice) ; le notebook
// refait alors ce clip au lieu de garder l'ancien.
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const drafts = process.argv.includes("--brouillons");
const norm = (text) => String(text || "").normalize("NFC").replace(/\s+/g, " ").trim();
const usable = (statut) => statut === "valide" || (drafts && statut === "a_verifier");

// Nom de fichier sans accent ni caractère spécial, unique (« réussie » devient « reussie »).
const usedFiles = new Set();
function fileNameFor(id) {
  const base = id.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9._]+/g, "_");
  let name = base;
  for (let n = 2; usedFiles.has(name); n++) name = base + "_" + n;
  usedFiles.add(name);
  return name;
}

// Clips actuels : nom de fichier -> texte lu.
const current = new Map();
const currentIndex = path.join(root, "data", "audio", "eton", "omnivoice", "omnivoice-index.json");
if (fs.existsSync(currentIndex)) {
  for (const clip of JSON.parse(fs.readFileSync(currentIndex, "utf8")).clips || []) current.set(clip.id, norm(clip.text));
}

const lines = [];
const skipped = [];
const seenTexts = new Set();
function add(id, text, origin) {
  const value = norm(text);
  if (!value) return;
  if (/\[M\d+\]/.test(value)) {
    skipped.push(id + " (valeur variable)");
    return;
  }
  if (seenTexts.has(value)) return; // même phrase déjà exportée : un seul clip suffit
  seenTexts.add(value);
  // « id » : nom du fichier audio ; « key » : identifiant d'origine dans les données d'ALPHA.
  const line = { id: fileNameFor(id), key: id, text: value, language_id: "eto", origin };
  if (current.has(line.id) && current.get(line.id) !== value) line.regenerer = true;
  lines.push(line);
}

const dictionary = read("data/dictionary.json");
for (const entry of dictionary.entries || []) {
  if (entry.statut === "valide") add("dict." + entry.id, entry.local, "dictionary");
}

// Libellé éton d'un bouton ou d'un champ, tel que la page traduite l'affiche (voir src/guide.js).
const etonOf = new Map(dictionary.entries.filter((e) => e.local).map((e) => [norm(e.fr).toLowerCase(), e.local]));
const guide = read("data/guide.json");
const labels = {};
for (const [key, variants] of Object.entries(guide.labels || {})) {
  const local = etonOf.get(norm(variants[0]).toLowerCase());
  if (local) labels[key] = norm(local).slice(0, 60).replace(/[\s:*]+$/, "");
}
for (const screen of guide.screens || []) {
  if (!screen.local || !usable(screen.local.statut)) continue;
  for (const part of ["where", "what", "how", "tip"]) {
    const text = screen.local[part];
    if (!text) continue;
    const missing = (text.match(/\{(\w+)\}/g) || []).filter((m) => !labels[m.slice(1, -1)]);
    if (missing.length) {
      skipped.push("guide." + screen.id + "." + part + " (bouton sans éton : " + missing.join(", ") + ")");
      continue;
    }
    add("guide." + screen.id + "." + part, text.replace(/\{(\w+)\}/g, (_, key) => labels[key]), "guide");
  }
}
guide.alerts.forEach((rule, i) => {
  if (rule.local && usable(rule.localStatut)) add("guide.alert." + i, rule.local, "guide");
});
if (guide.ui.local && guide.ui.local.unknownAlert && guide.screens.some((s) => s.local && usable(s.local.statut))) {
  add("guide.alert.inconnue", guide.ui.local.unknownAlert, "guide");
}

for (const entry of read("data/glossary.json").entries || []) {
  if (!entry.local || !usable(entry.local.statut)) continue;
  add("gloss." + entry.id + ".term", entry.local.term, "glossary");
  add("gloss." + entry.id + ".text", entry.local.text, "glossary");
}

const outDir = path.join(root, "docs", "audio");
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, "eton-tts.jsonl");
fs.writeFileSync(out, lines.map((line) => JSON.stringify(line)).join("\n") + "\n");
const fresh = lines.filter((l) => !current.has(l.id)).length;
const redo = lines.filter((l) => l.regenerer).length;
console.log(`${lines.length} texte(s) éton exporté(s) dans ${path.relative(root, out)} : ${fresh} nouveau(x), ${redo} à régénérer (texte modifié), ${lines.length - fresh - redo} déjà prêts.`);
if (skipped.length) console.log("Ignoré(s) : " + skipped.join(", "));
