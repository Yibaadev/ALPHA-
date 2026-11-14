"use strict";

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const checks = [
  ["tests core", "tools/test.js"],
  ["traduction automatique", "tools/test-mt.js"],
  ["messages inédits", "tools/test-unseen.js"],
  ["interface", "tools/test-ui-confidence.js"],
  ["gabarits", "tools/test-templates.js"],
  ["segments", "tools/test-segments.js"],
  ["règles", "tools/test-rules.js"],
  ["fuzzy", "tools/test-fuzzy.js"],
  ["cascade", "tools/test-cascade.js"],
  ["lexique", "tools/test-lexicon.js"],
  ["utilitaires moteur", "tools/test-engine-common.js"],
  ["contrôleur de traduction", "tools/test-translation-controller.js"],
  ["lecture vocale", "tools/test-voice.js"],
  ["guide de l'écran", "tools/test-guide.js"],
  ["expliquer (glossaire)", "tools/test-explain.js"],
  ["voix éton préenregistrées", "tools/test-eton-audio.js"],
  ["dictionnaire", "tools/check.js"],
];

let failed = false;
function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

console.log("=== vérifications statiques ===");
const projectCode = [...walk(path.join(root, "src")), ...walk(path.join(root, "tools"))]
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

for (const file of ["manifest.json", ...walk(path.join(root, "data")).filter((item) => item.endsWith(".json")), "tests/unseen/messages.json"]) {
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
