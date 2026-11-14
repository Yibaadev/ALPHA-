// Règles de style éton communes à toute l'extension, décidées par l'équipe :
//   1. on tutoie : « ù » (tu), jamais « mì » (vous) ;
//   2. Bénéficiaire = « mòd àtə́ nɔŋ » (libellé du dictionnaire validé), jamais « mòd à nɔŋ » ni « mòd àyá nɔŋ ».
// Appliquées au dictionnaire et à chaque import de traduction (tools/guide-eton.js), pour qu'une
// nouvelle revue ne réintroduise pas d'incohérence.
//   node tools/eton-style.js            -> liste ce qui changerait dans data/dictionary.json
//   node tools/eton-style.js --ecrire   -> applique les règles au dictionnaire
"use strict";

const fs = require("fs");
const path = require("path");

const BENEFICIARY = /(^|[^\p{L}])([Mm])òd à(?:yá)? nɔŋ(?![\p{L}\p{M}])/gu;
// « mì » sujet -> « ù ». Après « lóm » (« t'envoyer ») ou « ànə̀ » (« c'est toi »), c'est un pronom
// complément dont la forme au tutoiement est différente : laissé tel quel et signalé au locuteur.
const VOUS = /(^|[\s(«])([Mm])ì(?=[\s,.!?:;])/g;
const OBJECT_BEFORE = /(?:lóm|ànə̀)\s$/;

/* Retourne { text, changed, flags } ; flags = passages à faire vérifier par le locuteur. */
function harmonize(input) {
  const original = String(input == null ? "" : input);
  let text = original.normalize("NFC");
  const flags = [];
  text = text.replace(BENEFICIARY, (_, before, m) => before + (m === "M" ? "Mòd" : "mòd") + " àtə́ nɔŋ");
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
      if (!/style éton/.test(entry.note || "")) entry.note = (entry.note ? entry.note + " " : "") + "Harmonisé selon le style éton d'ALPHA (tutoiement, « mòd àtə́ nɔŋ »).";
    }
    for (const flag of result.flags) report.push(entry.id + " : " + flag);
  }
  if (write) fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
  return report;
}

if (require.main === module) {
  const write = process.argv.includes("--ecrire");
  const report = harmonizeDictionary(write);
  console.log(report.length ? report.join("\n") : "Dictionnaire déjà conforme au style éton.");
  console.log(write ? "\nDictionnaire mis à jour." : "\n(aperçu : ajoutez --ecrire pour appliquer)");
}

module.exports = { harmonize, harmonizeDictionary };
