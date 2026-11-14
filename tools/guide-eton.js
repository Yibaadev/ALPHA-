// Traduction en éton du guide « ? », de la bulle ALPHA et du glossaire « Expliquer ».
// La traduction est faite HORS de l'extension (Gemini, sur le site de Google), puis vérifiée
// par un locuteur. L'extension ne contient aucun modèle d'IA et n'envoie rien.
//
//   node tools/guide-eton.js export
//       -> docs/traduction/PROMPT_GEMINI.md  (texte à coller dans Gemini)
//   node tools/guide-eton.js import docs/traduction/gemini-eton.json
//       -> remplit data/guide.json et data/glossary.json (statut « a_verifier »)
//       -> docs/traduction/revue-guide-eton.csv (feuille de revue pour le locuteur)
//   node tools/guide-eton.js import docs/traduction/gemini-eton.json docs/traduction/revue-guide-eton.csv
//       -> applique la revue : « oui » ou une correction = « valide », « non » sans correction = retiré
"use strict";

const fs = require("fs");
const { harmonize } = require("./eton-style.js");
const path = require("path");

const root = path.join(__dirname, "..");
const files = {
  guide: path.join(root, "data", "guide.json"),
  glossary: path.join(root, "data", "glossary.json"),
  dictionary: path.join(root, "data", "dictionary.json"),
};
const outDir = path.join(root, "docs", "traduction");
const UI_KEYS = ["where", "what", "how", "alert", "known", "unknownAlert", "secretTip"];
const GLOSSARY_UI_KEYS = ["button", "title", "listen", "close", "hint"];
const PARTS = ["where", "what", "how", "tip"];

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const writeJson = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
// Gemini marque ses mots incertains par [?] : on les retire de l’affichage, la feuille de revue les signale.
const DOUBT = /\s*\[\?\]/g;
const clean = (text) => text.replace(DOUBT, "").trim();
const placeholders = (text) => (String(text).match(/\{[a-z]+\}/g) || []).sort().join(",");

// CSV « ; » ou « , » (Excel, Google Sheets) -> tableau d'objets indexés par l'en-tête.
function parseCsv(text) {
  const clean = text.replace(/^\uFEFF/, "");
  const first = clean.split(/\r?\n/, 1)[0];
  const sep = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ";" : ",";
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (quoted) {
      if (c === '"' && clean[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && clean[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [header = [], ...body] = rows.filter((r) => r.some((v) => v.trim()));
  const keys = header.map((h) => h.trim().toLowerCase());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i] || ""])));
}

/* Liste de tous les textes fixes à traduire : { id, fr, en, where (pour le locuteur) }. */
function units(guide, glossary) {
  const list = [];
  const add = (id, fr, en, where) => fr && list.push({ id, fr, en: en || "", where });
  for (const key of UI_KEYS) add("ui." + key, guide.ui.fr[key], guide.ui.en[key], "Guide : titres et conseils");
  for (const screen of guide.screens) {
    for (const part of PARTS) add("screen." + screen.id + "." + part, screen.fr[part], screen.en[part], "Guide : écran " + screen.id);
  }
  guide.alerts.forEach((rule, i) => add("alert." + i, rule.fr, rule.en, "Guide : conseil après un message d'erreur"));
  const intro = guide.intro;
  add("intro.title", intro.fr.title, intro.en.title, "Bulle de présentation");
  intro.fr.lines.forEach((line, i) => add("intro.line." + i, line, intro.en.lines[i], "Bulle de présentation"));
  add("intro.about", intro.fr.about, intro.en.about, "Bulle de présentation");
  add("intro.ok", intro.fr.ok, intro.en.ok, "Bulle de présentation");
  for (const key of GLOSSARY_UI_KEYS) {
    add("glossary.ui." + key, glossary.meta.ui.fr[key], glossary.meta.ui.en[key], "Expliquer : boutons");
  }
  for (const entry of glossary.entries) {
    add("glossary." + entry.id + ".term", entry.fr.term, entry.en.term, "Expliquer : terme");
    add("glossary." + entry.id + ".text", entry.fr.text, entry.en.text, "Expliquer : définition de « " + entry.fr.term + " »");
  }
  return list;
}

function exportPrompt() {
  const guide = readJson(files.guide);
  const glossary = readJson(files.glossary);
  const dictionary = readJson(files.dictionary);
  const lexicon = dictionary.entries
    .filter((e) => e.local && e.statut === "valide")
    .map((e) => "- " + e.fr + " = " + e.local)
    .join("\n");
  const source = {};
  for (const u of units(guide, glossary)) source[u.id] = u.fr;

  const prompt = `Tu es traducteur vers l'éton (langue bantoue A71 du Cameroun, région du Centre, proche de l'ewondo).
Traduis en éton les textes français ci-dessous. Ils servent d'aide à l'écran pour une application bancaire.

Règles :
1. Réponds UNIQUEMENT par un objet JSON valide, avec exactement les mêmes clés, et la traduction éton comme valeur.
2. Garde tels quels les éléments entre accolades, par exemple {start} ou {confirm} : ce sont des noms de boutons insérés automatiquement.
3. Garde tels quels les nombres, les pourcentages (1,5 %), les sigles (FCFA, SMS, ALPHA) et les guillemets « ».
4. Phrases courtes et simples, compréhensibles à l'oral.
5. Utilise EXACTEMENT les mots du lexique validé ci-dessous quand le sens correspond.
6. Si tu n'es pas sûr d'un mot, mets ta meilleure proposition suivie de [?]. Ne laisse aucune valeur vide.

Lexique éton validé par un locuteur (français = éton) :
${lexicon}

Textes à traduire :
\`\`\`json
${JSON.stringify(source, null, 2)}
\`\`\`
`;
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "PROMPT_GEMINI.md"), prompt, "utf8");
  console.log(Object.keys(source).length + " textes à traduire -> docs/traduction/PROMPT_GEMINI.md");
}

// Réponse de Gemini collée dans un fichier : on tolère les ``` autour du JSON.
function readAnswer(file) {
  const text = fs.readFileSync(file, "utf8").replace(/^﻿/, "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("Aucun objet JSON trouvé dans " + file);
  return JSON.parse(text.slice(start, end + 1));
}

// Revue du locuteur : id -> { text, statut } ; null = proposition refusée.
function readReview(file) {
  const review = {};
  if (!file) return review;
  for (const row of parseCsv(fs.readFileSync(file, "utf8"))) {
    if (!row.id) continue;
    const correction = (row.correction || "").trim();
    const verdict = (row.correct || "").trim().toLowerCase();
    if (correction) review[row.id] = { text: correction, statut: "valide" };
    else if (verdict === "oui") review[row.id] = { text: null, statut: "valide" };
    else if (verdict === "non") review[row.id] = null;
  }
  return review;
}

function importAnswer(answerFile, reviewFile) {
  const guide = readJson(files.guide);
  const glossary = readJson(files.glossary);
  const answer = readAnswer(answerFile);
  const review = readReview(reviewFile);
  const all = units(guide, glossary);
  const accepted = {};
  const problems = [];
  const warnings = [];
  const counts = { valide: 0, a_verifier: 0 };

  for (const u of all) {
    let text = typeof answer[u.id] === "string" ? clean(answer[u.id]) : "";
    let statut = "a_verifier";
    if (u.id in review) {
      if (review[u.id] === null) continue;
      if (review[u.id].text) text = review[u.id].text;
      statut = review[u.id].statut;
    }
    if (!text) { problems.push(u.id + " : aucune traduction"); continue; }
    // Style éton commun (tutoiement, « mòd àtə́ nɔŋ ») : appliqué même aux corrections du locuteur.
    const styled = harmonize(text);
    text = styled.text;
    for (const flag of styled.flags) warnings.push(u.id + " : " + flag);
    if (placeholders(text) !== placeholders(u.fr)) {
      problems.push(u.id + " : les éléments {…} ne correspondent pas au français (" + placeholders(u.fr) + ")");
      continue;
    }
    accepted[u.id] = { text, statut };
    counts[statut]++;
  }

  const get = (id) => accepted[id] && accepted[id].text;
  // Un bloc est « valide » seulement si tous ses textes le sont.
  const statusOf = (ids) => (ids.every((id) => accepted[id] && accepted[id].statut === "valide") ? "valide" : "a_verifier");

  const ui = {};
  for (const key of UI_KEYS) if (get("ui." + key)) ui[key] = get("ui." + key);
  guide.ui.local = Object.keys(ui).length ? ui : null;

  for (const screen of guide.screens) {
    const ids = PARTS.filter((p) => screen.fr[p]).map((p) => "screen." + screen.id + "." + p);
    if (!ids.every(get)) { screen.local = null; continue; } // écran incomplet : reste en français
    screen.local = { statut: statusOf(ids) };
    for (const id of ids) screen.local[id.split(".").pop()] = get(id);
  }
  guide.alerts.forEach((rule, i) => {
    rule.local = get("alert." + i) || null;
    rule.localStatut = rule.local ? accepted["alert." + i].statut : undefined;
  });

  const intro = guide.intro;
  const introIds = ["intro.title", ...intro.fr.lines.map((_, i) => "intro.line." + i), "intro.about", "intro.ok"];
  intro.local = introIds.every(get)
    ? {
        title: get("intro.title"),
        lines: intro.fr.lines.map((_, i) => get("intro.line." + i)),
        about: get("intro.about"),
        ok: get("intro.ok"),
        statut: statusOf(introIds),
      }
    : null;

  const gui = {};
  for (const key of GLOSSARY_UI_KEYS) if (get("glossary.ui." + key)) gui[key] = get("glossary.ui." + key);
  glossary.meta.ui.local = Object.keys(gui).length ? gui : null;
  for (const entry of glossary.entries) {
    const ids = ["glossary." + entry.id + ".term", "glossary." + entry.id + ".text"];
    entry.local = ids.every(get) ? { term: get(ids[0]), text: get(ids[1]), statut: statusOf(ids) } : null;
  }

  const source = "Proposition de traduction par Gemini (Google), hors de l'extension, vérifiée par un locuteur.";
  const statut = counts.a_verifier ? "a_verifier" : "valide";
  Object.assign(guide.meta, { statut_local: statut, source_local: source });
  Object.assign(glossary.meta, { statut_local: statut, source_local: source });
  writeJson(files.guide, guide);
  writeJson(files.glossary, glossary);

  // Feuille de revue pour le locuteur (séparateur « ; », ouvrable dans Excel).
  const q = (v) => (/[;"\r\n]/.test(v) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v));
  const rows = [["id", "endroit", "francais", "eton_propose", "doute_gemini", "correct", "correction"].join(";")];
  const old = reviewFile ? parseCsv(fs.readFileSync(reviewFile, "utf8")) : [];
  const oldById = Object.fromEntries(old.map((r) => [r.id, r]));
  for (const u of all) {
    const proposed = typeof answer[u.id] === "string" ? answer[u.id].trim() : "";
    const prev = oldById[u.id] || {};
    rows.push([u.id, u.where, u.fr, clean(proposed), proposed.includes("[?]") ? "oui" : "", prev.correct || "", prev.correction || ""].map(q).join(";"));
  }
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "revue-guide-eton.csv"), "﻿" + rows.join("\r\n") + "\r\n", "utf8");

  console.log(`Traductions intégrées : ${counts.valide} validées, ${counts.a_verifier} à vérifier, sur ${all.length}.`);
  if (problems.length) console.log("Non intégrées (restent en français) :\n  " + problems.join("\n  "));
  if (warnings.length) console.log("À faire vérifier par le locuteur :\n  " + warnings.join("\n  "));
  console.log("Feuille de revue : docs/traduction/revue-guide-eton.csv");
}

if (require.main === module) {
  const [command, answerFile, reviewFile] = process.argv.slice(2);
  if (command === "export") exportPrompt();
  else if (command === "import" && answerFile) importAnswer(answerFile, reviewFile);
  else console.log("Usage : node tools/guide-eton.js export | import <reponse-gemini.json> [revue.csv]");
}

module.exports = { units, placeholders, parseCsv, readAnswer, readReview };
