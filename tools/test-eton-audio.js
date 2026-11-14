// Tests des voix éton préenregistrées : index des clips (priorité au locuteur, revue),
// et cohérence des clips livrés avec le dictionnaire.
// Lancer : node tools/test-eton-audio.js
"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { parseCsv, buildIndex } = require("./build-audio-index");

const root = path.join(__dirname, "..");
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

// Dossier de test : 4 clips OmniVoice, une revue, un enregistrement du locuteur.
function fixture(csv) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "alpha-audio-"));
  fs.mkdirSync(path.join(base, "omnivoice"));
  fs.mkdirSync(path.join(base, "locuteur"));
  const clips = ["dict.a", "dict.b", "dict.c", "dict.d"].map((id) => ({ id, key: id, text: "éton " + id, file: id + ".ogg" }));
  for (const clip of clips) fs.writeFileSync(path.join(base, "omnivoice", clip.file), "OggS");
  fs.writeFileSync(path.join(base, "omnivoice", "omnivoice-index.json"), JSON.stringify({ modele: "k2-fsa/OmniVoice", clips }));
  if (csv) fs.writeFileSync(path.join(base, "omnivoice", "revue_locuteur.csv"), csv);
  fs.writeFileSync(path.join(base, "locuteur", "dict.d.mp3"), "ID3");
  return base;
}
const sources = (index) => Object.fromEntries(index.clips.map((c) => [c.key, c.source + ":" + c.revue]));

test("revue au format Colab (virgules) et Excel français (points-virgules, guillemets)", () => {
  const colab = parseCsv("id,texte,correct,remarque\ndict.a,Mwàní,oui,\ndict.b,\"Táŋ, ton\",non,ton faux\n");
  assert.strictEqual(colab.get("dict.a").correct, "oui");
  assert.strictEqual(colab.get("dict.b").remarque, "ton faux");
  const excel = parseCsv("﻿id;texte;correct;remarque\r\ndict.a;Mwàní;OUI;\r\n");
  assert.strictEqual(excel.get("dict.a").correct, "oui");
});

test("par défaut : seuls les clips validés « oui » et ceux du locuteur", () => {
  const base = fixture("id,texte,correct,remarque\ndict.a,x,oui,\ndict.b,x,non,\ndict.c,x,,\n");
  const { index } = buildIndex(base, false);
  assert.deepStrictEqual(sources(index), { "dict.a": "omnivoice:oui", "dict.d": "locuteur:oui" });
});

test("--inclure-non-revus : ajoute les clips non écoutés, jamais ceux refusés", () => {
  const base = fixture("id,texte,correct,remarque\ndict.a,x,oui,\ndict.b,x,non,\ndict.c,x,,\n");
  const { index, counts } = buildIndex(base, true);
  assert.deepStrictEqual(sources(index), {
    "dict.a": "omnivoice:oui", "dict.c": "omnivoice:a_verifier", "dict.d": "locuteur:oui",
  });
  assert.strictEqual(counts.refuses, 1);
});

test("l'enregistrement du locuteur remplace toujours le clip OmniVoice, même refusé", () => {
  const base = fixture("id,texte,correct,remarque\ndict.d,x,non,\n");
  const { index } = buildIndex(base, false);
  const d = index.clips.find((c) => c.key === "dict.d");
  assert.strictEqual(d.file, "locuteur/dict.d.mp3");
});

test("sans revue ni clips : index vide, sans erreur", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "alpha-audio-"));
  assert.deepStrictEqual(buildIndex(base, true).index.clips, []);
});

// --- clips réellement livrés avec l'extension ---
const indexFile = path.join(root, "data", "audio", "eton", "index.json");
const shipped = fs.existsSync(indexFile) ? JSON.parse(fs.readFileSync(indexFile, "utf8")) : { clips: [] };

test("chaque clip de l'index existe et est un vrai fichier audio", () => {
  for (const clip of shipped.clips) {
    const file = path.join(root, "data", "audio", "eton", clip.file);
    assert.ok(fs.existsSync(file), "clip absent : " + clip.file);
    const magic = fs.readFileSync(file).subarray(0, 4).toString("latin1");
    assert.ok(["OggS", "RIFF", "ID3\u0003", "ID3\u0004"].includes(magic) || magic.startsWith("ID3") || magic.charCodeAt(0) === 0xff,
      "format audio inconnu : " + clip.file);
  }
});

test("chaque clip correspond au texte éton actuel du dictionnaire (pas de clip périmé)", () => {
  const entries = new Map(JSON.parse(fs.readFileSync(path.join(root, "data", "dictionary.json"), "utf8"))
    .entries.map((e) => ["dict." + e.id, e]));
  // Comparaison sur les mots (la ponctuation ne s'entend pas).
  const words = (t) => (String(t || "").normalize("NFC").toLowerCase().replace(/'/g, "’")
    .match(/[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*/gu) || []).join(" ");
  for (const clip of shipped.clips.filter((c) => c.key.startsWith("dict."))) {
    // « dict.x.partie1 » : morceau fixe d'une entrée contenant une valeur [M1].
    const part = clip.key.match(/^(.*)\.partie(\d+)$/);
    const entry = entries.get(part ? part[1] : clip.key);
    assert.ok(entry, "entrée supprimée du dictionnaire : " + clip.key);
    const expected = part ? entry.local.split(/\[M\d+\]/)[Number(part[2]) - 1] : entry.local;
    assert.strictEqual(words(clip.text), words(expected), "texte éton modifié depuis la génération du clip : " + clip.key);
  }
});

test("le manifeste rend les clips accessibles à l'extension", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
  const resources = manifest.web_accessible_resources[0].resources;
  for (const needed of ["data/audio/eton/index.json", "data/audio/eton/omnivoice/*.ogg", "data/audio/eton/locuteur/*"]) {
    assert.ok(resources.includes(needed), "ressource manquante : " + needed);
  }
});

console.log(passed + " test(s) voix éton réussi(s) — " + shipped.clips.length + " clip(s) livrés.");
