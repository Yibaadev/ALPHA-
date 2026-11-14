// Règles de style éton communes à toute l'extension, décidées par l'équipe :
//   1. on tutoie : « ù » (tu), jamais « mì » (vous) ;
//   2. Bénéficiaire = « mòd àtə́ nɔŋ » (libellé du dictionnaire validé), jamais « mòd à nɔŋ » ni « mòd àyá nɔŋ » ;
//   3. Compte = « kɔ̂nt », jamais « kônt ».
// Appliquées au dictionnaire et à chaque import de traduction (tools/guide-eton.js), pour qu'une
// nouvelle revue ne réintroduise pas d'incohérence.
//   node tools/eton-style.js            -> liste ce qui changerait dans data/dictionary.json
//   node tools/eton-style.js --ecrire   -> applique les règles au dictionnaire
"use strict";

const fs = require("fs");
const path = require("path");

// 3. Compte = « kɔ̂nt » (forme du locuteur, ex. « Nwàmɔ̀ kɔ̂nt »), jamais « kônt ».
const ACCOUNT = /([Kk])ônt/gu;
// 4. Frais = « táŋ » (dictionnaire), « Frais de transfert » = « táŋ í nlóm » ; jamais « mwàní wà ísɛ́ ».
const FEES = [
  [/([Mm])wàní wà ísɛ́ yà nlóm/gu, (_, m) => (m === "M" ? "Táŋ" : "táŋ") + " í nlóm"],
  [/([Mm])wàní wà ísɛ́/gu, (_, m) => (m === "M" ? "Táŋ" : "táŋ")],
];
const BENEFICIARY =/(^|[^\p{L}])([Mm])òd à(?:yá)? nɔŋ(?![\p{L}\p{M}])/gu;
// « mì » complément : formes au tutoiement données par le locuteur.
//   « lóm mì mwàní » (t'envoyer de l'argent) -> « lóm wɔ̀ mwàní » ; « ànə̀ mì » (c'est toi) -> « à nə̀ wɔ̀ ».
const OBJECTS = [
  [/(^|[^\p{L}\p{M}])([Ll])óm mì(?![\p{L}\p{M}])/gu, (_, before, l) => before + l + "óm wɔ̀"],
  [/(^|[^\p{L}\p{M}])([Àà])nə̀ mì(?![\p{L}\p{M}])/gu, (_, before, a) => before + a + " nə̀ wɔ̀"],
];
// « mì » sujet -> « ù ». Un autre « mì » complément (après « lóm » ou « ànə̀ ») dont la forme n'est pas
// encore connue est laissé tel quel et signalé au locuteur.
const VOUS = /(^|[\s(«])([Mm])ì(?=[\s,.!?:;])/g;
const OBJECT_BEFORE = /(?:lóm|ànə̀)\s$/;

/* Retourne { text, changed, flags } ; flags = passages à faire vérifier par le locuteur. */
function harmonize(input) {
  const original = String(input == null ? "" : input);
  let text = original.normalize("NFC");
  const flags = [];
  text = text.replace(ACCOUNT, (_, k) => k + "ɔ̂nt");
  for (const [pattern, fix] of FEES) text = text.replace(pattern, fix);
  text = text.replace(BENEFICIARY,(_, before, m) => before + (m === "M" ? "Mòd" : "mòd") + " àtə́ nɔŋ");
  for (const [pattern, fix] of OBJECTS) text = text.replace(pattern, fix);
  text = text.replace(VOUS, (match, before, m, offset, whole) => {
    if (OBJECT_BEFORE.test(whole.slice(0, offset + before.length))) {
      flags.push("« mì » complément gardé, forme au tutoiement à donner : « " + whole.slice(Math.max(0, offset - 12), offset + 12).trim() + " »");
      return match;
    }
    return before + (m === "M" ? "Ù" : "ù");
  });
  return { text, changed: text !== original.normalize("NFC"), flags };
}

function harmonizeDictionary(write) {
  const file = path.join(__dirname, "..", "data", "dictionary.json");
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const report = [];
  for (const entry of data.entries) {
    if (!entry.local) continue;
    const result = harmonize(entry.local);
    if (result.changed) {
      report.push(entry.id + " :\n    " + entry.local + "\n -> " + result.text);
      entry.local = result.text;
      if (!/style éton/.test(entry.note || "")) entry.note = (entry.note ? entry.note + " " : "") + "Harmonisé selon le style éton d'ALPHA (tutoiement, « mòd àtə́ nɔŋ », « kɔ̂nt »).";
    }
    for (const flag of result.flags) report.push(entry.id + " : " + flag);
  }
  if (write) fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
  return report;
}

/* Phrases modèles (data/templates.json) : même style, et même éton que le dictionnaire quand le
   français est identique (« Frais » -> « Táŋ ») ou de la forme « <entrée> : [M1] ». */
function harmonizeTemplates(write) {
  const root = path.join(__dirname, "..", "data");
  const templates = JSON.parse(fs.readFileSync(path.join(root, "templates.json"), "utf8"));
  const dictionary = JSON.parse(fs.readFileSync(path.join(root, "dictionary.json"), "utf8"));
  const byFr = new Map(dictionary.entries.filter((e) => e.local && e.statut === "valide")
    .map((e) => [e.fr.trim().toLowerCase(), harmonize(e.local).text]));
  const report = [];
  for (const template of templates) {
    if (!template.eton) continue;
    const fr = template.fr_pattern.trim();
    let target = byFr.get(fr.toLowerCase());
    const withValue = fr.match(/^(.*?)\s*:\s*\[M1\]$/);
    if (!target && withValue && byFr.has(withValue[1].toLowerCase())) {
      target = byFr.get(withValue[1].toLowerCase()).replace(/\s*:$/, "") + " : [M1]";
    }
    const result = harmonize(target || template.eton);
    if (result.text !== template.eton.normalize("NFC")) {
      report.push(template.id + " :\n    " + template.eton + "\n -> " + result.text);
      template.eton = result.text;
    }
    for (const flag of result.flags) report.push(template.id + " : " + flag);
  }
  if (write) fs.writeFileSync(path.join(root, "templates.json"), JSON.stringify(templates, null, 4) + "\n", "utf8");
  return report;
}

if (require.main === module) {
  const write = process.argv.includes("--ecrire");
  const report = harmonizeDictionary(write).concat(harmonizeTemplates(write));
  console.log(report.length ? report.join("\n") : "Dictionnaire et phrases modèles déjà conformes au style éton.");
  console.log(write ? "\nDictionnaire et phrases modèles mis à jour." : "\n(aperçu : ajoutez --ecrire pour appliquer)");
}

module.exports = { harmonize, harmonizeDictionary, harmonizeTemplates };
