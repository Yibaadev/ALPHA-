// Tests de la traduction éton du guide et du glossaire (tools/guide-eton.js, src/guide.js, src/explain.js) :
// éléments {…} protégés, revue du locuteur, affichage éton seulement quand la traduction existe,
// mention « à vérifier » tant que le locuteur n'a pas validé.
// Lancer : node tools/test-guide-eton.js
"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const vm = require("vm");
const tool = require("./guide-eton.js");

const root = path.join(__dirname, "..");
const load = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const context = vm.createContext({ console });
for (const file of ["src/guide.js", "src/explain.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
}
const { guide: G, explain: E } = context.ALPHA;

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    console.error("ÉCHEC : " + name + "\n  " + e.message);
    process.exitCode = 1;
  }
}

const guideData = load("data/guide.json");
const glossaryData = load("data/glossary.json");
const item = (kind, orig, shown) => ({ kind, orig, shown: shown || orig });
const summary = {
  title: "",
  items: [item("text", "Récapitulatif"), item("text", "Total débité"), item("text", "Référence"),
    item("button", "Confirmer le transfert", "Kàm ɔ̀mán"), item("button", "Modifier")],
};

test("la liste couvre le guide, la bulle et le glossaire, avec des identifiants uniques", () => {
  const units = tool.units(guideData, glossaryData);
  const ids = units.map((u) => u.id);
  assert.strictEqual(new Set(ids).size, ids.length);
  assert.ok(ids.includes("screen.summary.how") && ids.includes("intro.title") && ids.includes("glossary.fees.text"));
  assert.strictEqual(units.filter((u) => u.id.startsWith("glossary.") && u.id.endsWith(".text")).length, glossaryData.entries.length);
});

test("les éléments {…} sont comparés quel que soit leur ordre", () => {
  assert.strictEqual(tool.placeholders("« {edit} » puis « {confirm} »"), tool.placeholders("{confirm} … {edit}"));
  assert.notStrictEqual(tool.placeholders("{confirm}"), tool.placeholders("sans bouton"));
});

test("réponse de Gemini lue même entourée de ```json", () => {
  const file = path.join(os.tmpdir(), "alpha-gemini-test.json");
  fs.writeFileSync(file, "Voici :\n```json\n{\"ui.where\": \"Vé me ne ?\"}\n```\n");
  assert.strictEqual(tool.readAnswer(file)["ui.where"], "Vé me ne ?");
  fs.unlinkSync(file);
});

test("revue : correction ou « oui » = validé, « non » = retiré", () => {
  const file = path.join(os.tmpdir(), "alpha-revue-test.csv");
  fs.writeFileSync(file, "﻿id;endroit;francais;eton_propose;correct;correction\r\na;x;y;z;oui;\r\nb;x;y;z;;\"Texte; corrigé\"\r\nc;x;y;z;non;\r\nd;x;y;z;;\r\n");
  const review = tool.readReview(file);
  assert.deepStrictEqual(review.a, { text: null, statut: "valide" });
  assert.deepStrictEqual(review.b, { text: "Texte; corrigé", statut: "valide" });
  assert.strictEqual(review.c, null);
  assert.ok(!("d" in review));
  fs.unlinkSync(file);
});

// Données avec une traduction éton (fictive) pour l'écran récapitulatif.
const withEton = JSON.parse(JSON.stringify(guideData));
for (const s of withEton.screens) s.local = null;
for (const a of withEton.alerts) a.local = null;
withEton.ui.local = { where: "ETO-où", what: "ETO-quoi", how: "ETO-comment" };
withEton.screens.find((s) => s.id === "summary").local = {
  statut: "a_verifier", where: "ETO récapitulatif", what: "ETO relire", how: "ETO appuyer « {confirm} » ou « {edit} »",
};

test("éton : écran traduit affiché en éton, boutons cités tels qu'affichés", () => {
  G.init(withEton);
  const g = G.build(summary, "local", "fr");
  assert.strictEqual(g.where, "ETO récapitulatif");
  assert.strictEqual(g.labels.where, "ETO-où");
  assert.ok(g.how.includes("« Kàm ɔ̀mán »"), g.how);
});

test("éton non vérifié : mention de la traduction automatique en cours de vérification", () => {
  G.init(withEton);
  assert.ok(/en cours de vérification par un locuteur/.test(G.build(summary, "local", "fr").note));
  const valid = JSON.parse(JSON.stringify(withEton));
  valid.screens.find((s) => s.id === "summary").local.statut = "valide";
  G.init(valid);
  assert.strictEqual(G.build(summary, "local", "fr").note, valid.ui.fr.known);
});

test("éton : écran sans traduction reste entièrement en français (titres compris)", () => {
  G.init(withEton);
  const g = G.build({ title: "", items: [item("text", "Votre compte"), item("text", "Solde disponible"), item("button", "Effectuer un transfert")] }, "local", "fr");
  assert.strictEqual(g.labels.where, "Où suis-je ?");
  assert.ok(/attente de validation/.test(g.note));
});

test("français et anglais inchangés quand l'éton existe", () => {
  G.init(withEton);
  assert.strictEqual(G.build(summary, "fr", "fr").where, guideData.screens.find((s) => s.id === "summary").fr.where);
  assert.strictEqual(G.build(summary, "en", "fr").labels.where, "Where am I?");
});

test("éton : conseil d'alerte en éton, ou conseil générique éton s'il n'est pas traduit", () => {
  const data = JSON.parse(JSON.stringify(withEton));
  data.ui.local.unknownAlert = "ETO lisez";
  data.alerts[0].local = "ETO montant";
  G.init(data);
  const alertOf = (text) => G.build({ title: "", items: summary.items.concat(item("alert", text)) }, "local", "fr").alert.advice;
  assert.strictEqual(alertOf("Le montant doit être supérieur à zéro."), "ETO montant");
  assert.strictEqual(alertOf("Solde insuffisant pour ce transfert."), "ETO lisez");
});

test("Expliquer en éton : explication traduite, mention « à vérifier »", () => {
  const data = JSON.parse(JSON.stringify(glossaryData));
  for (const e of data.entries) e.local = null;
  data.entries.find((e) => e.id === "fees").local = { term: "Táŋ", text: "ETO frais", statut: "a_verifier" };
  data.meta.ui.local = { title: "ETO explication" };
  E.init(data);
  const r = E.explain("frais", "local", "fr");
  assert.strictEqual(r.items[0].term, "Táŋ");
  assert.strictEqual(r.title, "ETO explication");
  assert.ok(/en cours de vérification/.test(r.note));
  assert.strictEqual(E.explain("frais", "fr", "fr").items[0].term, "Frais");
});

test("données livrées : éton passé par l'import (statut, éléments {…} intacts, sans [?])", () => {
  for (const s of guideData.screens) {
    if (!s.local) continue;
    assert.ok(["valide", "a_verifier"].includes(s.local.statut), s.id);
    for (const part of ["where", "what", "how", "tip"]) {
      assert.strictEqual(tool.placeholders(s.local[part] || ""), tool.placeholders(s.fr[part] || ""), s.id + "." + part);
    }
  }
  for (const e of glossaryData.entries) assert.ok(e.local === null || ["valide", "a_verifier"].includes(e.local.statut), e.id);
  assert.ok(!(JSON.stringify(guideData) + JSON.stringify(glossaryData)).includes("[?]"), "marque [?] restée à l'écran");
});


// Style éton commun : tutoiement et « mòd àtə́ nɔŋ » partout.
const { harmonize } = require("./eton-style.js");
test("style éton : « mì » sujet devient « ù », majuscule comprise", () => {
  assert.strictEqual(harmonize("Mì yì nâ mì jə́blə́ màm.").text, "Ù yì nâ ù jə́blə́ màm.");
  assert.strictEqual(harmonize("Tə̀ mì tìl màm.").text, "Tə̀ ù tìl màm.");
});
test("style éton : « mì » complément laissé tel quel et signalé", () => {
  const r = harmonize("Kàtgá ɲə́ vè bɔ̀d bə̀tə̀ lóm mì mwàní.");
  assert.ok(r.text.includes("lóm mì mwàní"));
  assert.strictEqual(r.flags.length, 1);
});
test("style éton : bénéficiaire toujours « mòd àtə́ nɔŋ »", () => {
  assert.strictEqual(harmonize("Mòd à nɔŋ").text, "Mòd àtə́ nɔŋ");
  assert.strictEqual(harmonize("ábə́ mòd àyá nɔŋ mwàní").text, "ábə́ mòd àtə́ nɔŋ mwàní");
  assert.strictEqual(harmonize("Mwàní mòd àtə́ nɔŋ àyá nɔŋ").text, "Mwàní mòd àtə́ nɔŋ àyá nɔŋ");
});
test("données livrées : plus aucune incohérence de style dans les textes validés", () => {
  const dictionary = load("data/dictionary.json");
  const texts = dictionary.entries.filter((e) => e.local && e.statut === "valide").map((e) => e.local);
  for (const s of guideData.screens) if (s.local && s.local.statut === "valide") texts.push(s.local.where, s.local.what, s.local.how, s.local.tip || "");
  for (const e of glossaryData.entries) if (e.local && e.local.statut === "valide") texts.push(e.local.term, e.local.text);
  for (const text of texts) assert.strictEqual(harmonize(text).text, String(text).normalize("NFC"), text);
});
console.log(passed + " test(s) traduction éton du guide et style éton réussi(s).");
