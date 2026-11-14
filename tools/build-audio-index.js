// Construit data/audio/eton/index.json : la liste des clips éton que l'extension peut lire.
// Lancer : node tools/build-audio-index.js            (clips validés seulement)
//          node tools/build-audio-index.js --inclure-non-revus   (essais : clips pas encore écoutés)
//
// Règles, pour chaque texte :
// 1. un enregistrement du locuteur (data/audio/eton/locuteur/<id>.ogg|.mp3|.wav) passe toujours en premier ;
// 2. sinon le clip OmniVoice, s'il est marqué « oui » dans revue_locuteur.csv ;
// 3. un clip marqué « non » n'est jamais utilisé ; un clip non revu seulement avec --inclure-non-revus.
"use strict";

const fs = require("fs");
const path = require("path");

// CSV de Colab (virgules) ou réenregistré par Excel en français (points-virgules), guillemets acceptés.
function parseCsv(text) {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0];
  const sep = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ";" : ",";
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
  const [header, ...body] = rows.filter((r) => r.some((cell) => cell.trim()));
  if (!header) return new Map();
  const col = (name) => header.findIndex((h) => h.trim().toLowerCase() === name);
  const id = col("id");
  const ok = col("correct");
  const note = col("remarque");
  return new Map(body.map((r) => [
    (r[id] || "").trim(),
    { correct: (r[ok] || "").trim().toLowerCase(), remarque: (r[note] || "").trim() },
  ]));
}

function readJson(file) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
}

// base : dossier data/audio/eton (ou un dossier de test).
function buildIndex(base, includeUnreviewed) {
  const omni = readJson(path.join(base, "omnivoice", "omnivoice-index.json")) || { clips: [] };
  const reviewFile = path.join(base, "omnivoice", "revue_locuteur.csv");
  const review = fs.existsSync(reviewFile) ? parseCsv(fs.readFileSync(reviewFile, "utf8")) : new Map();
  const speakerDir = path.join(base, "locuteur");
  const speakerFiles = new Map(
    (fs.existsSync(speakerDir) ? fs.readdirSync(speakerDir) : [])
      .filter((f) => /\.(ogg|mp3|wav)$/i.test(f))
      .map((f) => [f.replace(/\.(ogg|mp3|wav)$/i, ""), f])
  );

  const clips = [];
  const counts = { locuteur: 0, oui: 0, a_verifier: 0, refuses: 0, absents: 0 };
  for (const clip of omni.clips) {
    const speaker = speakerFiles.get(clip.id);
    if (speaker) {
      clips.push({ key: clip.key, text: clip.text, file: "locuteur/" + speaker, source: "locuteur", revue: "oui" });
      counts.locuteur++;
      continue;
    }
    if (!fs.existsSync(path.join(base, "omnivoice", clip.file))) { counts.absents++; continue; }
    const verdict = (review.get(clip.id) || {}).correct || "";
    if (/^(non|no|n|x)$/.test(verdict)) { counts.refuses++; continue; }
    const accepted = /^(oui|yes|o|y|ok)$/.test(verdict);
    if (!accepted && !includeUnreviewed) continue;
    clips.push({ key: clip.key, text: clip.text, file: "omnivoice/" + clip.file, source: "omnivoice", revue: accepted ? "oui" : "a_verifier" });
    counts[accepted ? "oui" : "a_verifier"]++;
  }

  const index = {
    meta: {
      description: "Clips éton lus par l'extension (généré par tools/build-audio-index.js, ne pas modifier à la main).",
      modele_synthese: omni.modele || "k2-fsa/OmniVoice",
      genere_le: new Date().toISOString().slice(0, 10),
      inclut_non_revus: Boolean(includeUnreviewed),
    },
    clips,
  };
  return { index, counts, total: omni.clips.length };
}

if (require.main === module) {
  const base = path.join(__dirname, "..", "data", "audio", "eton");
  const includeUnreviewed = process.argv.includes("--inclure-non-revus");
  const { index, counts, total } = buildIndex(base, includeUnreviewed);
  fs.writeFileSync(path.join(base, "index.json"), JSON.stringify(index, null, 2) + "\n");
  console.log(
    index.clips.length + " clip(s) dans data/audio/eton/index.json — locuteur : " + counts.locuteur +
    ", OmniVoice validés : " + counts.oui + ", OmniVoice non revus : " + counts.a_verifier +
    ", refusés : " + counts.refuses + (counts.absents ? ", fichiers absents : " + counts.absents : "")
  );
  if (!includeUnreviewed && !index.clips.length && total) {
    console.log("Aucun clip validé : faites remplir revue_locuteur.csv, ou testez avec --inclure-non-revus.");
  }
}

module.exports = { parseCsv, buildIndex };
