// Construit extension/data/audio/eton/index.json : la liste des clips éton que l'extension peut lire.
// Lancer : node scripts/audio/build-audio-index.js            (clips validés seulement)
//          node scripts/audio/build-audio-index.js --inclure-non-revus   (essais : clips pas encore écoutés)
//
// Règles, pour chaque texte :
// 1. un enregistrement du locuteur (extension/data/audio/eton/locuteur/<id>.ogg|.mp3|.wav) passe toujours en premier ;
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

// Forme de comparaison : la suite de mots, sans ponctuation ni majuscules (comme extension/src/voice/eton-audio.js).
const normText = (t) => {
  const words = String(t || "").normalize("NFC").toLowerCase().replace(/'/g, "’").match(/[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*/gu);
  return words ? words.join(" ") : String(t || "").trim();
};

// Durée d'un fichier Ogg Opus (dernière position de page, à 48 kHz, moins le pré-roulage) :
// un clip vide (génération ratée) dure 0 s et n'est pas utilisé.
function oggSeconds(buffer) {
  if (buffer.length < 32 || buffer.toString("latin1", 0, 4) !== "OggS") return buffer.length > 0 ? 1 : 0; // autre format
  let last = 0;
  for (let i = buffer.indexOf("OggS"); i >= 0 && i + 14 <= buffer.length; i = buffer.indexOf("OggS", i + 4)) {
    const granule = Number(buffer.readBigInt64LE(i + 6));
    if (granule > 0) last = granule;
  }
  return Math.max(0, last - 312) / 48000;
}

/* Emplacements :
   - extension/data/audio/eton/          clips livrés (omnivoice/*.ogg, locuteur/*) et index.json généré ici ;
   - content/audio/omnivoice/            lots reçus de Colab (omnivoice-index*.json) et feuilles de revue.
   Chaque passage sur Colab livre son propre index (omnivoice-index-AAAAMMJJ-HHMM.json) et sa propre
   feuille de revue : on ne renvoie que les nouveaux textes sans jamais écraser les lots précédents.
   Ici on les fusionne, du plus ancien au plus récent (le plus récent l'emporte pour un même clip). */
function batchFiles(dir, pattern) {
  return (fs.existsSync(dir) ? fs.readdirSync(dir) : []).filter((f) => pattern.test(f)).sort()
    .map((f) => path.join(dir, f));
}
// metaDir : dossier des lots Colab (content/audio/omnivoice).
function readOmniIndexes(metaDir) {
  const dir = metaDir;
  const byId = new Map();
  let modele = null;
  for (const file of batchFiles(dir, /^omnivoice-index.*\.json$/)) {
    const data = readJson(file) || {};
    modele = data.modele || modele;
    for (const clip of data.clips || []) byId.set(clip.id, clip);
  }
  return { modele, clips: [...byId.values()] };
}
function readReviews(metaDir) {
  const review = new Map();
  for (const file of batchFiles(metaDir, /^revue_locuteur.*\.csv$/)) {
    for (const [id, row] of parseCsv(fs.readFileSync(file, "utf8"))) {
      if (row.correct || !review.has(id)) review.set(id, row); // une réponse donnée n'est pas effacée par une ligne vide
    }
  }
  return review;
}

// base : dossier des clips (extension/data/audio/eton, ou un dossier de test).
// currentTexts (facultatif) : textes éton actuels (content/audio/eton-tts.jsonl) ; un clip dont le texte
// n'y figure plus est périmé (texte corrigé depuis) et n'est pas utilisé.
// metaDir : lots Colab et revues (par défaut base/omnivoice, pour les tests).
function buildIndex(base, includeUnreviewed, currentTexts, metaDir = path.join(base, "omnivoice")) {
  const omni = readOmniIndexes(metaDir);
  const review = readReviews(metaDir);
  const speakerDir = path.join(base, "locuteur");
  const speakerFiles = new Map(
    (fs.existsSync(speakerDir) ? fs.readdirSync(speakerDir) : [])
      .filter((f) => /\.(ogg|mp3|wav)$/i.test(f))
      .map((f) => [f.replace(/\.(ogg|mp3|wav)$/i, ""), f])
  );

  const clips = [];
  const counts = { locuteur: 0, oui: 0, a_verifier: 0, refuses: 0, absents: 0, perimes: 0, vides: 0 };
  for (const clip of omni.clips) {
    if (currentTexts && !currentTexts.has(normText(clip.text))) { counts.perimes++; continue; }
    const speaker = speakerFiles.get(clip.id);
    if (speaker) {
      clips.push({ key: clip.key, text: clip.text, file: "locuteur/" + speaker, source: "locuteur", revue: "oui" });
      counts.locuteur++;
      continue;
    }
    if (!fs.existsSync(path.join(base, "omnivoice", clip.file))) { counts.absents++; continue; }
    if (oggSeconds(fs.readFileSync(path.join(base, "omnivoice", clip.file))) < 0.15) { counts.vides++; continue; }
    const verdict = (review.get(clip.id) || {}).correct || "";
    if (/^(non|no|n|x)$/.test(verdict)) { counts.refuses++; continue; }
    const accepted = /^(oui|yes|o|y|ok)$/.test(verdict);
    if (!accepted && !includeUnreviewed) continue;
    clips.push({ key: clip.key, text: clip.text, file: "omnivoice/" + clip.file, source: "omnivoice", revue: accepted ? "oui" : "a_verifier" });
    counts[accepted ? "oui" : "a_verifier"]++;
  }

  const index = {
    meta: {
      description: "Clips éton lus par l'extension (généré par scripts/audio/build-audio-index.js, ne pas modifier à la main).",
      modele_synthese: omni.modele || "k2-fsa/OmniVoice",
      genere_le: new Date().toISOString().slice(0, 10),
      inclut_non_revus: Boolean(includeUnreviewed),
    },
    clips,
  };
  return { index, counts, total: omni.clips.length };
}

if (require.main === module) {
  const base = path.join(__dirname, "..", "..", "extension", "data", "audio", "eton");
  const META = path.join(__dirname, "..", "..", "content", "audio", "omnivoice");
  const includeUnreviewed = process.argv.includes("--inclure-non-revus");
  const exportFile = path.join(__dirname, "..", "..", "content", "audio", "eton-tts.jsonl");
  const currentTexts = fs.existsSync(exportFile)
    ? new Set(fs.readFileSync(exportFile, "utf8").split(/\r?\n/).filter(Boolean).map((l) => normText(JSON.parse(l).text)))
    : null;
  if (!currentTexts) console.log("content/audio/eton-tts.jsonl absent : lancez d'abord npm run audio:export (clips périmés non détectés).");
  const { index, counts, total } = buildIndex(base, includeUnreviewed, currentTexts, META);
  // Une seule voix de synthèse pour tous les clips : sinon une phrase change de voix en cours de lecture.
  const voices = new Map();
  for (const clip of readOmniIndexes(META).clips) {
    if (!voices.has(clip.voix)) voices.set(clip.voix, []);
    voices.get(clip.voix).push(clip.id);
  }
  if (voices.size > 1) {
    const sorted = [...voices].sort((a, b) => b[1].length - a[1].length);
    console.log("Attention : plusieurs voix mélangées. Voix principale : " + sorted[0][0] + ". À refaire avec elle :");
    for (const [voice, ids] of sorted.slice(1)) console.log("  " + voice + " : " + ids.join(", "));
  }
  fs.writeFileSync(path.join(base, "index.json"), JSON.stringify(index, null, 2) + "\n");
  console.log(
    index.clips.length + " clip(s) dans extension/data/audio/eton/index.json — locuteur : " + counts.locuteur +
    ", OmniVoice validés : " + counts.oui + ", OmniVoice non revus : " + counts.a_verifier +
    ", refusés : " + counts.refuses + (counts.perimes ? ", périmés (texte corrigé, à régénérer) : " + counts.perimes : "") + (counts.vides ? ", vides (à régénérer) : " + counts.vides : "") + (counts.absents ? ", fichiers absents : " + counts.absents : "")
  );
  if (!includeUnreviewed && !index.clips.length && total) {
    console.log("Aucun clip validé : faites remplir revue_locuteur.csv, ou testez avec --inclure-non-revus.");
  }
}

module.exports = { parseCsv, buildIndex, normText, oggSeconds, readOmniIndexes, readReviews };
