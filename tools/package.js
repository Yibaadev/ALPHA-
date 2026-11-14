// Fabrique le fichier d'extension à soumettre : dist/alpha-extension.zip.
// N'y met que ce que l'extension utilise : manifeste, icônes, scripts et styles déclarés, données
// chargées, et seulement les clips audio de l'index (pas la documentation, les outils, ni git).
// Taille maximale autorisée pour la soumission : 10 Mo.
//   node tools/package.js
"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.join(__dirname, "..");
const MAX_BYTES = 10 * 1024 * 1024;

// Liste des fichiers de l'extension (chemins relatifs, avec « / »).
function listFiles() {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
  const files = new Set(["manifest.json"]);
  for (const icon of Object.values(manifest.icons || {})) files.add(icon);
  for (const script of manifest.content_scripts || []) {
    for (const f of [...(script.js || []), ...(script.css || [])]) files.add(f);
  }
  const audioIndex = JSON.parse(fs.readFileSync(path.join(root, "data", "audio", "eton", "index.json"), "utf8"));
  for (const group of manifest.web_accessible_resources || []) {
    for (const resource of group.resources || []) {
      if (!resource.includes("*")) files.add(resource);
    }
  }
  // Clips : uniquement ceux que l'index fait lire.
  for (const clip of audioIndex.clips || []) files.add("data/audio/eton/" + clip.file);
  return [...files].sort();
}

function sizeOf(files) {
  return files.reduce((total, f) => total + fs.statSync(path.join(root, f)).size, 0);
}

function build() {
  const files = listFiles();
  const missing = files.filter((f) => !fs.existsSync(path.join(root, f)));
  if (missing.length) throw new Error("Fichiers introuvables : " + missing.join(", "));
  const dist = path.join(root, "dist");
  const stage = path.join(dist, "alpha-extension");
  fs.rmSync(stage, { recursive: true, force: true });
  for (const f of files) {
    const target = path.join(stage, f);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(root, f), target);
  }
  const zip = path.join(dist, "alpha-extension.zip");
  fs.rmSync(zip, { force: true });
  // Windows 10+ : tar.exe du système (bsdtar) écrit un zip ; sinon PowerShell ; ailleurs, zip.
  const attempts = process.platform === "win32"
    ? [
        [path.join(process.env.SystemRoot || "C:\\Windows", "System32", "tar.exe"), ["-a", "-c", "-f", zip, "-C", stage, "."], {}],
        ["powershell.exe", ["-NoProfile", "-Command", `Compress-Archive -Path '${stage}\\*' -DestinationPath '${zip}' -Force`], {}],
      ]
    : [["zip", ["-r", "-q", zip, "."], { cwd: stage }]];
  let done = false;
  for (const [command, args, options] of attempts) {
    try {
      execFileSync(command, args, { stdio: "pipe", ...options });
      done = fs.existsSync(zip);
      if (done) break;
    } catch (e) {
      /* essai suivant */
    }
  }
  if (!done) throw new Error("Impossible de créer le zip (ni tar, ni PowerShell, ni zip).");
  return { files, raw: sizeOf(files), zipped: fs.statSync(zip).size, zip };
}

if (require.main === module) {
  const { files, raw, zipped, zip } = build();
  const mo = (bytes) => (bytes / 1024 / 1024).toFixed(2) + " Mo";
  console.log(files.length + " fichiers, " + mo(raw) + " décompressés -> " + path.relative(root, zip) + " : " + mo(zipped));
  if (zipped > MAX_BYTES) {
    console.error("TROP LOURD : la limite de soumission est de 10 Mo.");
    process.exitCode = 1;
  } else {
    console.log("Sous la limite de 10 Mo (marge : " + mo(MAX_BYTES - zipped) + ").");
  }
}

module.exports = { listFiles, sizeOf, MAX_BYTES };
