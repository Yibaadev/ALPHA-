// Banque de messages bancaires probables (contenu inédit introduit par le jury) et textes du site
// encore sans éton. Même circuit que le guide : Gemini HORS de l'extension propose l'éton, le
// locuteur valide. Seules les traductions « valide » sont affichées et lues (règle du moteur).
//
//   node scripts/translation/bank-eton.js ajouter
//       -> ajoute la banque (content/traduction/banque-messages.json) au dictionnaire, en français et en
//          anglais ; l'éton reste vide (statut « a_verifier »)
//   node scripts/translation/bank-eton.js export
//       -> content/traduction/PROMPT_GEMINI_BANQUE.md (textes du dictionnaire sans éton validé)
//   node scripts/translation/bank-eton.js import content/traduction/gemini-banque.json [content/traduction/revue-banque-eton.csv]
//       -> remplit l'éton (style éton commun appliqué), « a_verifier » sauf ligne validée par le locuteur
//       -> content/traduction/revue-banque-eton.csv (feuille du locuteur)
"use strict";

const fs = require("fs");
const path = require("path");
const { harmonize } = require("./eton-style.js");
const { readAnswer, readReview, parseCsv, clean } = require("./guide-eton.js");

const root = path.join(__dirname, "..", "..");
const DICTIONARY = path.join(root, "extension", "data", "dictionary.json");
const BANK = path.join(root, "content", "traduction", "banque-messages.json");
const OUT = path.join(root, "content", "traduction");
const PREFIX = "bank_";

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const writeJson = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
const markers = (text) => (String(text).match(/\[M\d+\]/g) || []).sort().join(",");
// Comparaison du français : casse, espaces et point final ignorés (comme la recherche du moteur).
const key = (text) => String(text).normalize("NFC").replace(/[‘’ʼ]/g, "'").replace(/\s+/g, " ").trim().toLowerCase().replace(/\.$/, "");

function addBank() {
  const dictionary = readJson(DICTIONARY);
  const bank = readJson(BANK).messages;
  const known = new Map(dictionary.entries.map((e) => [key(e.fr), e.id]));
  let added = 0;
  const duplicates = [];
  for (const message of bank) {
    const id = PREFIX + message.id;
    const existing = dictionary.entries.find((e) => e.id === id);
    if (existing) {
      Object.assign(existing, { fr: message.fr, en: message.en });
      continue;
    }
    if (known.has(key(message.fr))) {
      duplicates.push(message.id + " (déjà présent : " + known.get(key(message.fr)) + ")");
      continue;
    }
    dictionary.entries.push({
      id, screen: "Banque de messages", fr: message.fr, en: message.en, local: null,
      note: "Message bancaire probable (catégorie " + message.categorie + ").", statut: "a_verifier",
    });
    known.set(key(message.fr), id);
    added++;
  }
  writeJson(DICTIONARY, dictionary);
  console.log(added + " message(s) ajouté(s) au dictionnaire (français et anglais ; éton à traduire).");
  if (duplicates.length) console.log("Déjà dans le dictionnaire, non ajoutés :\n  " + duplicates.join("\n  "));
}

// Textes à faire traduire : toute entrée du dictionnaire sans éton validé.
const pending = (dictionary) => dictionary.entries.filter((e) => e.fr && e.statut !== "valide");

function exportPrompt() {
  const dictionary = readJson(DICTIONARY);
  const lexicon = dictionary.entries.filter((e) => e.local && e.statut === "valide")
    .map((e) => "- " + e.fr + " = " + e.local).join("\n");
  const source = {};
  for (const entry of pending(dictionary)) source[entry.id] = entry.fr;
  const prompt = `Tu es traducteur vers l'éton (langue bantoue A71 du Cameroun, région du Centre, proche de l'ewondo).
Traduis en éton les messages français ci-dessous. Ils s'affichent dans une application bancaire.

Règles :
1. Réponds UNIQUEMENT par un objet JSON valide, avec exactement les mêmes clés, et la traduction éton comme valeur.
2. Garde tels quels les marqueurs [M1], [M2]… : ce sont des montants, des noms ou des dates insérés automatiquement. Chaque marqueur doit apparaître une fois.
3. Garde tels quels les nombres, les pourcentages, les sigles (FCFA, SMS, PIN, ALPHA) et les guillemets « ».
4. Tutoie l'utilisateur : « ù » (tu), jamais « mì » (vous).
5. Bénéficiaire = « mòd àtə́ nɔŋ » ; compte = « kɔ̂nt » ; frais = « táŋ ».
6. Respecte le sens exact : une négation, un échec, un refus ou une alerte doivent rester présents.
7. Utilise EXACTEMENT les mots du lexique validé ci-dessous quand le sens correspond. Phrases courtes et simples.
8. Si tu n'es pas sûr d'un mot, mets ta meilleure proposition suivie de [?]. Ne laisse aucune valeur vide.

Lexique éton validé par un locuteur (français = éton) :
${lexicon}

Messages à traduire :
\`\`\`json
${JSON.stringify(source, null, 2)}
\`\`\`
`;
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "PROMPT_GEMINI_BANQUE.md"), prompt, "utf8");
  console.log(Object.keys(source).length + " messages à traduire -> content/traduction/PROMPT_GEMINI_BANQUE.md");
}

// Points à signaler au locuteur (accord grammatical : on ne corrige pas automatiquement).
function lookAt(text) {
  const notes = [];
  if (/(^|[^p{L}p{M}])wô(?![p{L}p{M}])/u.test(text)) notes.push("possessif « wô » : les textes validés écrivent « wɔ̂ » (mwàní wɔ̂) ou « yɔ̂ » (kɔ̂nt yɔ̂)");
  return notes.join(" ; ");
}

function importAnswer(answerFile, reviewFile) {
  const dictionary = readJson(DICTIONARY);
  const answer = readAnswer(answerFile);
  const review = readReview(reviewFile);
  const old = reviewFile ? Object.fromEntries(parseCsv(fs.readFileSync(reviewFile, "utf8")).map((r) => [r.id, r])) : {};
  const counts = { valide: 0, a_verifier: 0 };
  const problems = [];
  const warnings = [];
  const rows = [];
  for (const entry of dictionary.entries) {
    if (!(entry.id in answer) && !(entry.id in review)) continue;
    if (entry.statut === "valide" && !(entry.id in review)) continue; // déjà validé : on n'y touche pas
    const proposed = typeof answer[entry.id] === "string" ? answer[entry.id].trim() : "";
    rows.push({ entry, proposed });
    let text = clean(proposed);
    let statut = "a_verifier";
    if (entry.id in review) {
      if (review[entry.id] === null) { entry.local = null; entry.statut = "a_verifier"; continue; }
      if (review[entry.id].text) text = review[entry.id].text;
      statut = review[entry.id].statut;
    }
    if (!text) { problems.push(entry.id + " : aucune traduction"); continue; }
    const styled = harmonize(text);
    text = styled.text;
    for (const flag of styled.flags) warnings.push(entry.id + " : " + flag);
    if (markers(text) !== markers(entry.fr)) {
      problems.push(entry.id + " : marqueurs différents du français (" + (markers(entry.fr) || "aucun") + ")");
      continue;
    }
    entry.local = text;
    entry.statut = statut;
    if (!/Gemini/.test(entry.note || "")) entry.note = (entry.note ? entry.note + " " : "") + "Éton proposé par Gemini (hors extension), validé par le locuteur.";
    counts[statut]++;
  }
  writeJson(DICTIONARY, dictionary);

  const q = (v) => (/[;"\r\n]/.test(v) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v));
  const lines = [["id", "francais", "eton_propose", "doute_gemini", "a_regarder", "correct", "correction"].join(";")];
  for (const { entry, proposed } of rows) {
    const prev = old[entry.id] || {};
    lines.push([entry.id, entry.fr, harmonize(clean(proposed)).text, proposed.includes("[?]") ? "oui" : "", lookAt(proposed), prev.correct || "", prev.correction || ""].map(q).join(";"));
  }
  fs.writeFileSync(path.join(OUT, "revue-banque-eton.csv"), "﻿" + lines.join("\r\n") + "\r\n", "utf8");

  console.log(`Éton intégré : ${counts.valide} validé(s), ${counts.a_verifier} à vérifier (pas encore affiché ni lu).`);
  if (problems.length) console.log("Non intégrés :\n  " + problems.join("\n  "));
  if (warnings.length) console.log("À faire vérifier par le locuteur :\n  " + warnings.join("\n  "));
  console.log("Feuille de revue : content/traduction/revue-banque-eton.csv");
}

if (require.main === module) {
  const [command, answerFile, reviewFile] = process.argv.slice(2);
  if (command === "ajouter") addBank();
  else if (command === "export") exportPrompt();
  else if (command === "import" && answerFile) importAnswer(answerFile, reviewFile);
  else console.log("Usage : node scripts/translation/bank-eton.js ajouter | export | import <reponse-gemini.json> [revue.csv]");
}

module.exports = { key, markers, pending };
