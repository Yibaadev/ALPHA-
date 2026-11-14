// Intègre un zip téléchargé depuis Colab (alpha_eton_omnivoice.zip) au bon endroit :
//   - les clips *.ogg            -> extension/data/audio/eton/omnivoice/   (livrés avec l'extension)
//   - omnivoice-index-*.json     -> content/audio/omnivoice/               (liste du lot, non livrée)
//   - revue_locuteur-*.csv       -> content/audio/omnivoice/               (feuille du locuteur)
// puis reconstruit l'index lu par l'extension (mode essai : clips pas encore écoutés inclus).
//   npm run audio:import -- "C:\Users\...\Downloads\alpha_eton_omnivoice (5).zip"
// Un fichier déjà présent n'est remplacé que s'il s'agit d'un clip refait (même nom).
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.join(__dirname, "..", "..");
const CLIPS = path.join(root, "extension", "data", "audio", "eton", "omnivoice");
const META = path.join(root, "content", "audio", "omnivoice");

function extract(zip, into) {
  const attempts = process.platform === "win32"
    ? [[path.join(process.env.SystemRoot || "C:\\Windows", "System32", "tar.exe"), ["-x", "-f", zip, "-C", into]],
       ["powershell.exe", ["-NoProfile", "-Command", `Expand-Archive -LiteralPath '${zip}' -DestinationPath '${into}' -Force`]]]
    : [["unzip", ["-q", zip, "-d", into]]];
  for (const [command, args] of attempts) {
    try {
      execFileSync(command, args, { stdio: "pipe" });
      return;
    } catch (e) {
      /* essai suivant */
    }
  }
  throw new Error("Impossible d'ouvrir le zip : " + zip);
}

function importZip(zip) {
  if (!zip || !fs.existsSync(zip)) throw new Error("Zip introuvable : " + zip);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "alpha-colab-"));
  try {
    extract(path.resolve(zip), temp);
    const counts = { clips: 0, meta: 0, ignored: [] };
    for (const name of fs.readdirSync(temp)) {
      // Noms simples uniquement (pas de dossier ni de « .. ») : on ne fait confiance qu'au format attendu.
      if (!/^[A-Za-z0-9._-]+$/.test(name)) { counts.ignored.push(name); continue; }
      const from = path.join(temp, name);
      if (name.endsWith(".ogg")) {
        fs.mkdirSync(CLIPS, { recursive: true });
        fs.copyFileSync(from, path.join(CLIPS, name));
        counts.clips++;
      } else if (/^(omnivoice-index|revue_locuteur).*\.(json|csv)$/.test(name)) {
        fs.mkdirSync(META, { recursive: true });
        fs.copyFileSync(from, path.join(META, name));
        counts.meta++;
      } else {
        counts.ignored.push(name);
      }
    }
    return counts;
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

if (require.main === module) {
  const zip = process.argv[2];
  if (!zip) {
    console.log('Usage : npm run audio:import -- "chemin/vers/alpha_eton_omnivoice.zip"');
    process.exitCode = 1;
  } else {
    const counts = importZip(zip);
    console.log(counts.clips + " clip(s) -> extension/data/audio/eton/omnivoice/ ; " + counts.meta + " liste(s)/revue(s) -> content/audio/omnivoice/");
    if (counts.ignored.length) console.log("Ignorés : " + counts.ignored.join(", "));
    execFileSync(process.execPath, [path.join(__dirname, "export-eton-tts.js")], { stdio: "inherit" });
    execFileSync(process.execPath, [path.join(__dirname, "build-audio-index.js"), "--inclure-non-revus"], { stdio: "inherit" });
  }
}

module.exports = { importZip };
