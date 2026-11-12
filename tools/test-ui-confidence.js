"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const context = vm.createContext({ console });
vm.runInContext(fs.readFileSync(path.join(root, "src", "confidence.js"), "utf8"), context);
const confidence = context.ALPHA.confidence;
const panelSource = fs.readFileSync(path.join(root, "src", "panel.js"), "utf8");
const contentSource = fs.readFileSync(path.join(root, "src", "content.js"), "utf8");
const styleSource = fs.readFileSync(path.join(root, "src", "confidence.css"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));

const original = "Votre solde est de 25 000 FCFA";

// 1. Présentation propre du texte sans badges de vérification
const translated = confidence.present({ statut: "valide", eton: "Mwàní", marqueurs_ok: true }, original);
assert.strictEqual(translated.visibleText, "Mwàní");
assert.strictEqual(translated.showWarning, false, "aucun avertissement de vérification affiché");
assert.strictEqual(confidence.speechText(translated), "Mwàní", "la voix lit directement le texte sans annoncer de niveau de validation");

const untranslated = confidence.present({ statut: "non_traduit", eton: null, marqueurs_ok: true }, original);
assert.strictEqual(untranslated.visibleText, original);
assert.strictEqual(confidence.speechText(untranslated), original);

// 2. Vérification que les thèmes de validation / vérification et mentions d'IA sont retirés de l'UI
for (const forbidden of [
  "Fiabilité des traductions",
  "Vérifiée par une personne",
  "Proposition non vérifiée",
  "Contenu non vérifié",
  "vérifiez les montants avant de continuer",
  "Traduction non vérifiée",
  ".confidence-chip",
  ".confidence-legend",
]) {
  assert.ok(!panelSource.includes(forbidden), "le panneau ne doit pas contenir : " + forbidden);
}

// 3. Vérification des dimensions compactes et de la taille réduite des boutons
assert.ok(panelSource.includes("width: 290px"), "la largeur du panneau a été diminuée (290px au lieu de 390px)");
assert.ok(panelSource.includes("height: 38px"), "la hauteur des boutons de langue a été réduite (38px au lieu de 64px)");

// 4. Absence d'émojis et présence des contrôles d'accessibilité clés
assert.ok(!/[🟢🟡🟠🔴]/u.test(panelSource), "aucun emoji de statut dans le panneau");
assert.ok(panelSource.includes('id: "local"') && panelSource.includes("Éton"), "le mode Éton est présent");
assert.ok(panelSource.includes("speak") && panelSource.includes("zoom-control"), "lecture vocale et zoom conservés");

// 5. Inscription dans le manifeste
const scripts = manifest.content_scripts[0].js;
assert.ok(scripts.indexOf("src/confidence.js") < scripts.indexOf("src/panel.js"));
assert.ok(manifest.content_scripts[0].css.includes("src/confidence.css"));
assert.ok(manifest.web_accessible_resources[0].resources.includes("data/critical_terms.json"));
for (const file of [...scripts, ...manifest.content_scripts[0].css, ...manifest.web_accessible_resources[0].resources]) {
  assert.ok(fs.existsSync(path.join(root, file)), "fichier déclaré dans le manifeste : " + file);
}

console.log("UI ALPHA : suppression des thèmes de vérification/IA, dimensions compactes et ergonomie validées.");
