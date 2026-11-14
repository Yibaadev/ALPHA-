// Exporte les textes éton validés à faire lire par OmniVoice (Google Colab).
// Sortie : content/audio/eton-tts.jsonl, une ligne JSON par clip :
//   {"id", "key", "text", "language_id", "origin", "regenerer"?}
// Lancer : node scripts/audio/export-eton-tts.js            (textes validés seulement)
//          node scripts/audio/export-eton-tts.js --brouillons (ajoute les traductions encore à vérifier)
//
// Repris :
//  - dictionnaire : entrées « valide » sans valeur variable [M1] (un montant ou un nom change à chaque
//    fois : il ne peut pas être enregistré à l'avance) ;
//  - guide : chaque phrase des écrans connus, avec les noms de boutons éton du dictionnaire à la place
//    des {cles} (c'est exactement ce que le guide affiche sur la page) ; conseils d'alerte ;
// « regenerer » : le texte a changé depuis les clips actuels (extension/data/audio/eton/omnivoice) ; le notebook
// refait alors ce clip au lieu de garder l'ancien.
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "..");
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const drafts = process.argv.includes("--brouillons");
const redoAll = process.argv.includes("--tout"); // refaire tous les clips (même voix pour tout)
// --refaire nom. : refaire les clips dont l'identifiant commence par « nom. » (ex. mauvaise voix choisie).
const redoArg = process.argv.indexOf("--refaire");
const redoPrefix = redoArg >= 0 ? process.argv[redoArg + 1] || "" : null;
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
// Tous les lots déjà reçus de Colab (omnivoice-index*.json) sont pris en compte.
const current = new Map();
for (const clip of require("./build-audio-index.js").readOmniIndexes(path.join(root, "content", "audio", "omnivoice")).clips) {
  current.set(clip.id, norm(clip.text));
}

const lines = [];
const skipped = [];
const seenTexts = new Set();
function add(id, text, origin) {
  const value = norm(text);
  if (!value) return;
  // Valeur variable [M1] (montant, nom) : on enregistre les morceaux fixes autour ; à la lecture,
  // la phrase affichée est découpée en ces morceaux (extension/src/voice/eton-audio.js), la valeur n'est pas lue.
  if (/\[M\d+\]/.test(value)) {
    value.split(/\[M\d+\]/).map((part) => part.replace(/^[\s—–\-,;:]+|[\s—–\-,;]+$/g, ""))
      .forEach((part, n) => { if (/\p{L}/u.test(part)) add(id + ".partie" + (n + 1), part, origin); });
    return;
  }
  // Même suite de mots déjà exportée (seule la ponctuation diffère, ex. « Mòd àtə́ nɔŋ : ») : un seul
  // clip suffit, la lecture compare les mots (extension/src/voice/eton-audio.js).
  const words = value.toLowerCase().replace(/'/g, "’").match(/[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*/gu);
  const key = words ? words.join(" ") : value;
  if (seenTexts.has(key)) return;
  seenTexts.add(key);
  // « id » : nom du fichier audio ; « key » : identifiant d'origine dans les données d'ALPHA.
  const line = { id: fileNameFor(id), key: id, text: value, language_id: "eto", origin };
  const redoThis = redoAll || (redoPrefix !== null && redoPrefix !== "" && line.id.startsWith(redoPrefix));
  if (redoThis ? current.has(line.id) : current.has(line.id) && current.get(line.id) !== value) line.regenerer = true;
  lines.push(line);
}

const dictionary = read("extension/data/dictionary.json");
for (const entry of dictionary.entries || []) {
  if (entry.statut === "valide") add("dict." + entry.id, entry.local, "dictionary");
}
// Noms connus à l'avance (titulaire du compte de démonstration, bénéficiaires, services) : lus avec la
// même voix éton, pour que « Mə̀má kìrí, Amina Ngo Bell » soit lu en entier. Un nom saisi par
// l'utilisateur, inconnu à l'avance, n'est pas lu.
for (const name of (dictionary.meta && dictionary.meta.names) || []) add("nom." + name, name, "noms");

// Phrases modèles (« Solde disponible : [M1] ») : morceaux fixes.
for (const template of read("extension/data/templates.json")) {
  if (template.statut === "valide" && template.eton) add("tpl." + template.id, template.eton, "templates");
}

// Libellé éton d'un bouton ou d'un champ, tel que la page traduite l'affiche (voir extension/src/guide/guide.js).
const etonOf = new Map(dictionary.entries.filter((e) => e.local).map((e) => [norm(e.fr).toLowerCase(), e.local]));
const guide = read("extension/data/guide.json");
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
if (false) { // titre « unknownAlert » exporté avec les autres titres ci-dessous
  add("guide.alert.inconnue", guide.ui.local.unknownAlert, "guide");
}

// Titres du guide et bulle de présentation.
const anyGuide = guide.screens.some((s) => s.local && usable(s.local.statut));
for (const [key, text] of Object.entries((anyGuide && guide.ui.local) || {})) add("guide.ui." + key, text, "guide");
const intro = guide.intro.local;
if (intro && usable(intro.statut)) {
  add("intro.title", intro.title, "guide");
  intro.lines.forEach((line, i) => add("intro.line." + i, line, "guide"));
  add("intro.about", intro.about, "guide");
  add("intro.ok", intro.ok, "guide");
}

const outDir = path.join(root, "content", "audio");
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, "eton-tts.jsonl");
fs.writeFileSync(out, lines.map((line) => JSON.stringify(line)).join("\n") + "\n");
const fresh = lines.filter((l) => !current.has(l.id)).length;
const redo = lines.filter((l) => l.regenerer).length;
// Lot à envoyer sur Colab : seulement les clips à faire (nouveaux ou à régénérer).
const todo = lines.filter((l) => !current.has(l.id) || l.regenerer);
const outTodo = path.join(outDir, "eton-tts-a-generer.jsonl");
fs.writeFileSync(outTodo, todo.map((line) => JSON.stringify(line)).join("\n") + (todo.length ? "\n" : ""));
console.log(`${lines.length} texte(s) éton exporté(s) dans ${path.relative(root, out)} : ${fresh} nouveau(x), ${redo} à régénérer (texte modifié), ${lines.length - fresh - redo} déjà prêts.`);
console.log(`À envoyer sur Colab : ${path.relative(root, outTodo)} (${todo.length} clip(s) à faire seulement).`);
if (skipped.length) console.log("Ignoré(s) : " + skipped.join(", "));
