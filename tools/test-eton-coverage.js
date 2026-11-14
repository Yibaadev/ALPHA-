// Couverture vocale éton : chaque texte éton que l'extension peut afficher doit pouvoir être lu
// avec les clips de docs/audio/eton-tts.jsonl (le lot envoyé à OmniVoice). Seules les valeurs
// (montants, noms, numéros) et les mots restés en français ne sont pas lus.
// Lancer : node tools/test-eton-coverage.js
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const lines = fs.readFileSync(path.join(root, "docs", "audio", "eton-tts.jsonl"), "utf8")
  .split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
const index = { meta: {}, clips: lines.map((l) => ({ key: l.key, text: l.text, file: "omnivoice/" + l.id + ".ogg", source: "omnivoice" })) };

const context = vm.createContext({
  console,
  chrome: { runtime: { getURL: (p) => p } },
  fetch: async () => ({ ok: true, json: async () => index }),
});
vm.runInContext(fs.readFileSync(path.join(root, "src", "eton-audio.js"), "utf8"), context, { filename: "src/eton-audio.js" });
const audio = context.ALPHA.etonAudio.create({ hostId: "alpha-lang-panel" });

// Valeurs d'exemple à la place des [M1] : elles ne sont pas de l'éton et ne sont pas lues.
const SAMPLE = ["25 000 FCFA", "Amina Ngo Bell", "CM 001 2345", "12/11/2026", "04"];
const fillValues = (text) => text.replace(/\[M(\d+)\]/g, (_, n) => SAMPLE[(Number(n) - 1) % SAMPLE.length]);
const valueRuns = (text) => (text.match(/\[M\d+\]/g) || []).length;

const shown = []; // { where, text, values }
const dictionary = read("data/dictionary.json");
for (const e of dictionary.entries) if (e.local && e.statut === "valide") shown.push({ where: "dictionnaire " + e.id, text: e.local });
for (const t of read("data/templates.json")) if (t.eton && t.statut === "valide") shown.push({ where: "phrase modèle " + t.id, text: t.eton });

const guide = read("data/guide.json");
const etonOf = new Map(dictionary.entries.filter((e) => e.local).map((e) => [e.fr.trim().toLowerCase(), e.local]));
const label = (key) => etonOf.get(guide.labels[key][0].toLowerCase()).replace(/[\s:*]+$/, "");
for (const s of guide.screens) {
  if (!s.local) continue;
  for (const part of ["where", "what", "how", "tip"]) {
    if (s.local[part]) shown.push({ where: "guide " + s.id + "." + part, text: s.local[part].replace(/\{(\w+)\}/g, (_, k) => label(k)) });
  }
}
guide.alerts.forEach((a, i) => a.local && shown.push({ where: "conseil " + i, text: a.local }));
for (const [k, v] of Object.entries(guide.ui.local || {})) shown.push({ where: "titre guide " + k, text: v });
const intro = guide.intro.local;
if (intro) [intro.title, ...intro.lines, intro.about, intro.ok].forEach((t, i) => shown.push({ where: "bulle " + i, text: t }));
const glossary = read("data/glossary.json");
for (const e of glossary.entries) if (e.local) shown.push({ where: "Expliquer " + e.id, text: e.local.term }, { where: "Expliquer " + e.id, text: e.local.text });
for (const [k, v] of Object.entries(glossary.meta.ui.local || {})) shown.push({ where: "bouton Expliquer " + k, text: v });

let passed = 0;
(async () => {
  await audio.load();
  const silent = [];
  for (const item of shown) {
    const text = fillValues(item.text);
    const queue = audio.textQueue(text);
    if (!queue.items.length || queue.missing > valueRuns(item.text)) silent.push(item.where + " : « " + text + " »");
  }
  assert.deepStrictEqual(silent, [], "textes éton sans voix complète :\n  " + silent.join("\n  "));
  passed++;

  // Phrase assemblée par le moteur « segments » : morceaux du dictionnaire + valeur au milieu.
  const assembled = "Mwàní ú nè : 25 000 FCFA. " + dictionary.entries.find((e) => e.id === "fees").local;
  const queue = audio.textQueue(assembled);
  assert.strictEqual(queue.items.length, 2, "deux morceaux éton lus");
  assert.strictEqual(queue.missing, 1, "le montant n'est pas lu");
  passed++;

  // Ponctuation et majuscules ne gênent pas le découpage.
  assert.ok(audio.textQueue("mwàní ú nè").items.length === 1);
  passed++;

  console.log(passed + " test(s) couverture vocale : " + shown.length + " textes éton affichables, tous lisibles avec " + lines.length + " clips.");
})().catch((e) => {
  console.error("ÉCHEC : " + e.message);
  process.exitCode = 1;
});
