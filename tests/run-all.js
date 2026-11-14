"use strict";

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const checks = [
  ["tests core", "tests/core.test.js"],
  ["traduction automatique", "tests/mt.test.js"],
  ["messages inédits", "tests/unseen.test.js"],
  ["interface", "tests/ui-confidence.test.js"],
  ["gabarits", "tests/templates.test.js"],
  ["segments", "tests/segments.test.js"],
  ["règles", "tests/rules.test.js"],
  ["fuzzy", "tests/fuzzy.test.js"],
  ["cascade", "tests/cascade.test.js"],
  ["lexique", "tests/lexicon.test.js"],
  ["utilitaires moteur", "tests/engine-common.test.js"],
  ["contrôleur de traduction", "tests/translation-controller.test.js"],
  ["lecture vocale", "tests/voice.test.js"],
  ["guide de l'écran", "tests/guide.test.js"],
  ["guide en éton (traduction)", "tests/guide-eton.test.js"],
  ["voix éton préenregistrées", "tests/eton-audio.test.js"],
  ["couverture vocale éton", "tests/eton-coverage.test.js"],
  ["banque de messages (contenu inédit)", "tests/bank-eton.test.js"],
  ["paquet de soumission (moins de 10 Mo)", "tests/package.test.js"],
  ["dictionnaire", "tests/dictionary.test.js"],
];

let failed = false;
function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

console.log("=== vérifications statiques ===");
const projectCode = [...walk(path.join(root, "extension", "src")), ...walk(path.join(root, "scripts")), ...walk(path.join(root, "tests"))]
  .filter((file) => file.endsWith(".js") || file.endsWith(".css"));
for (const file of projectCode.filter((file) => file.endsWith(".js"))) {
  const result = spawnSync(process.execPath, ["--check", file], { cwd: root, encoding: "utf8", windowsHide: true });
  if (result.status !== 0) {
    console.error("Syntaxe invalide : " + path.relative(root, file));
    if (result.stderr) process.stderr.write(result.stderr);
    failed = true;
  }
}
for (const file of projectCode) {
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  const lineCount = lines.length - (lines[lines.length - 1] === "" ? 1 : 0);
  if (lineCount > 400) {
    console.error("Fichier trop long (" + lineCount + " lignes) : " + path.relative(root, file));
    failed = true;
  }
}

for (const file of ["extension/manifest.json", ...walk(path.join(root, "extension", "data")).filter((item) => item.endsWith(".json")), "tests/fixtures/unseen-messages.json"]) {
  try {
    JSON.parse(fs.readFileSync(path.isAbsolute(file) ? file : path.join(root, file), "utf8"));
  } catch (error) {
    console.error("JSON invalide : " + path.relative(root, file) + " — " + error.message);
    failed = true;
  }
}
if (!failed) console.log("Syntaxe JavaScript et fichiers JSON valides.");

for (const [label, script] of checks) {
  console.log("\n=== " + label + " ===");
  const result = spawnSync(process.execPath, [script], {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) {
    console.error("Échec au lancement : " + result.error.message);
    failed = true;
  } else if (result.status !== 0) {
    console.error("Échec : " + label + " (code " + result.status + ")");
    failed = true;
  }
}

if (failed) {
  process.exitCode = 1;
} else {
  console.log("\nToutes les vérifications ALPHA ont réussi.");
}
