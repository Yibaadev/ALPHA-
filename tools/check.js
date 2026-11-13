// Contrôle du dictionnaire. Lancer : node tools/check.js
// Vérifie les identifiants, les doublons et surtout que les marqueurs [M1], [M2]...
// sont identiques entre le français, l'anglais et la langue locale.
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "data", "dictionary.json");
const dict = JSON.parse(fs.readFileSync(file, "utf8"));

const norm = (s) =>
  s.normalize("NFC").replace(/[‘’ʼ]/g, "'").replace(/[\s  ]+/g, " ").trim().toLowerCase();
const markers = (s) => (s.match(/\[M\d+\]/g) || []).sort().join(",");

const errors = [];
const warnings = [];
const ids = new Set();
const keys = new Map();
let en = 0;
let local = 0;

for (const e of dict.entries) {
  if (!e.id) errors.push("Entrée sans identifiant : " + JSON.stringify(e));
  if (ids.has(e.id)) errors.push("Identifiant en double : " + e.id);
  ids.add(e.id);
  if (!e.fr || !e.fr.trim()) errors.push(e.id + " : texte français vide");

  for (const col of ["fr", "en"]) {
    if (!e[col] || !e[col].trim()) continue;
    const k = norm(e[col]);
    if (keys.has(k) && keys.get(k) !== e.id) errors.push("Texte en double (" + col + ") : " + e.id + " et " + keys.get(k));
    keys.set(k, e.id);
  }

  // Variantes anglaises (formulations d'un site) : mêmes règles que la colonne anglaise.
  for (const variant of Array.isArray(e.en_variants) ? e.en_variants : []) {
    const k = norm(variant);
    if (keys.has(k) && keys.get(k) !== e.id) errors.push("Variante anglaise en double : " + e.id + " et " + keys.get(k));
    keys.set(k, e.id);
    if (markers(variant) !== markers(e.fr)) errors.push(e.id + " : les marqueurs de la variante « " + variant + " » ne correspondent pas au français");
  }

  for (const col of ["en", "local"]) {
    if (!e[col] || !e[col].trim()) continue;
    if (col === "en") en++;
    else local++;
    if (markers(e[col]) !== markers(e.fr)) {
      errors.push(e.id + " : les marqueurs [M..] de « " + col + " » ne correspondent pas au français (" +
        (markers(e.fr) || "aucun") + " attendu, " + (markers(e[col]) || "aucun") + " trouvé)");
    }
  }
}

const total = dict.entries.length;
console.log("Entrées : " + total + " | anglais rempli : " + en + " | langue locale remplie : " + local);
if (local < total) warnings.push((total - local) + " entrée(s) sans traduction en langue locale.");
warnings.forEach((w) => console.log("Attention : " + w));
if (errors.length) {
  errors.forEach((x) => console.log("ERREUR : " + x));
  process.exit(1);
}
console.log("Dictionnaire valide.");
