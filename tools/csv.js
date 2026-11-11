// Passerelle entre le dictionnaire et un fichier CSV (ouvrable dans Excel / Google Sheets),
// pour que le locuteur remplisse les traductions sans toucher au code.
//   node tools/csv.js export            -> écrit docs/dictionnaire.csv
//   node tools/csv.js import <fichier>  -> met à jour data/dictionary.json (anglais, langue locale, note)
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const jsonFile = path.join(root, "data", "dictionary.json");
const csvOut = path.join(root, "docs", "dictionnaire.csv");
const HEADER = ["id", "ecran", "francais", "anglais", "langue_locale", "note"];

function quote(v) {
  v = v == null ? "" : String(v);
  return /[;"\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}

// Lecteur CSV simple : séparateur ";", guillemets doublés, retours à la ligne dans les champs.
function parse(text) {
  text = text.replace(/^﻿/, "");
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') inQuotes = false;
      else cell += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ";") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x !== "")) rows.push(row);
  return rows;
}

const cmd = process.argv[2];
const dict = JSON.parse(fs.readFileSync(jsonFile, "utf8"));

if (cmd === "export") {
  const lines = [HEADER.join(";")];
  for (const e of dict.entries) {
    lines.push([e.id, e.screen, e.fr, e.en, e.local, e.note].map(quote).join(";"));
  }
  fs.mkdirSync(path.dirname(csvOut), { recursive: true });
  // BOM UTF-8 : Excel affiche correctement les accents et les tons.
  fs.writeFileSync(csvOut, "﻿" + lines.join("\r\n") + "\r\n", "utf8");
  console.log("Écrit : " + csvOut + " (" + dict.entries.length + " lignes)");
} else if (cmd === "import") {
  const src = process.argv[3];
  if (!src) {
    console.error("Usage : node tools/csv.js import <fichier.csv>");
    process.exit(1);
  }
  const rows = parse(fs.readFileSync(src, "utf8"));
  const head = rows.shift().map((h) => h.trim());
  const col = (n) => head.indexOf(n);
  if (["id", "francais", "anglais", "langue_locale", "note"].some((n) => col(n) < 0)) {
    console.error("En-têtes attendus : " + HEADER.join(";"));
    process.exit(1);
  }
  const byId = new Map(dict.entries.map((e) => [e.id, e]));
  let updated = 0;
  for (const r of rows) {
    const e = byId.get((r[col("id")] || "").trim());
    if (!e) {
      console.warn("Identifiant inconnu, ligne ignorée : " + r[col("id")]);
      continue;
    }
    if ((r[col("francais")] || "").trim() !== e.fr.trim()) {
      console.warn("Le français de " + e.id + " a changé dans le CSV : ignoré (le français ne se modifie que dans le JSON).");
    }
    const en = (r[col("anglais")] || "").trim();
    const local = (r[col("langue_locale")] || "").trim();
    const note = (r[col("note")] || "").trim();
    if (en !== e.en || local !== e.local || note !== e.note) updated++;
    e.en = en;
    e.local = local;
    e.note = note;
  }
  fs.writeFileSync(jsonFile, JSON.stringify(dict, null, 2) + "\n", "utf8");
  console.log("Mis à jour : " + updated + " entrée(s). Lancez ensuite : node tools/check.js");
} else {
  console.error("Usage : node tools/csv.js export | import <fichier.csv>");
  process.exit(1);
}
