"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const context = vm.createContext({ console });
vm.runInContext(fs.readFileSync(path.join(root, "src", "confidence.js"), "utf8"), context);
const confidence = context.SAFINUM.confidence;
const panelSource = fs.readFileSync(path.join(root, "src", "panel.js"), "utf8");
const contentSource = fs.readFileSync(path.join(root, "src", "content.js"), "utf8");
const styleSource = fs.readFileSync(path.join(root, "src", "confidence.css"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));

const original = "Votre solde est de 25 000 FCFA";
const statuses = ["valide", "probable", "automatique", "non_traduit"];
for (const status of statuses) assert.ok(confidence.statuses[status], "statut avec libellé et icône : " + status);

const valid = confidence.present({ statut: "valide", eton: "Mwàní", marqueurs_ok: true }, original, false);
assert.strictEqual(valid.visibleText, "Mwàní");
assert.strictEqual(valid.originalText, null);
assert.ok(confidence.speechText(valid).includes("vérifiée"));

for (const status of ["probable", "automatique"]) {
  const display = confidence.present({ statut: status, eton: "CANDIDAT", marqueurs_ok: true }, original, false);
  assert.strictEqual(display.originalText, original);
  assert.strictEqual(display.showWarning, true);
  assert.ok(confidence.speechText(display).includes("non vérifiée"));
  assert.ok(confidence.speechText(display).includes(original));
  assert.ok(confidence.speechText(display).includes("Proposition en éton"));
}

const untranslated = confidence.present({ statut: "non_traduit", eton: null, marqueurs_ok: true }, original, false);
assert.strictEqual(untranslated.visibleText, original);
assert.strictEqual(untranslated.translation, null);
assert.strictEqual(untranslated.originalText, null, "le texte non traduit reste visible une seule fois");
assert.ok(confidence.speechText(untranslated).includes("Texte français original"));

const securityWarning = "Alerte de sécurité : vérifiez le numéro du bénéficiaire.";
const criticalTerms = require(path.join(root, "data", "critical_terms.json"));
assert.strictEqual(confidence.containsAnyTerm(securityWarning, criticalTerms.categories.securite), true);
const retainedOriginal = confidence.present({ statut: "valide", eton: "CANDIDAT", marqueurs_ok: true }, securityWarning, true);
assert.strictEqual(retainedOriginal.originalText, securityWarning);

const broken = confidence.present({ statut: "valide", eton: "CANDIDAT", marqueurs_ok: false }, original, false);
assert.strictEqual(broken.status, "non_traduit", "une intégrité invalide ne reçoit jamais le badge vert");

assert.ok(!panelSource.includes("confidence-legend"), "le panneau n’affiche plus de légende de fiabilité");
assert.ok(!contentSource.includes("safinum-status-badge"), "aucun badge de statut n’est injecté dans la page");
assert.ok(!/[🟢🟡🟠🔴]/u.test(panelSource), "pas d’emojis comme icônes");
assert.ok(panelSource.includes('id: "local"') && panelSource.includes("Éton"), "le mode Eton est sélectionnable");
assert.ok(panelSource.includes("speak") && panelSource.includes("zoom-control"), "lecture vocale et zoom conservés");
assert.ok(contentSource.includes("Confidence.speechText(display)"), "le niveau de confiance est annoncé à voix haute");
const scripts = manifest.content_scripts[0].js;
assert.ok(scripts.indexOf("src/confidence.js") < scripts.indexOf("src/panel.js"));
assert.ok(manifest.content_scripts[0].css.includes("src/confidence.css"));
assert.ok(manifest.web_accessible_resources[0].resources.includes("data/critical_terms.json"));
for (const file of [...scripts, ...manifest.content_scripts[0].css, ...manifest.web_accessible_resources[0].resources]) {
  assert.ok(fs.existsSync(path.join(root, file)), "fichier déclaré dans le manifeste : " + file);
}
for (const color of ["#dcfce7", "#fef3c7", "#ffedd5", "#fee2e2"]) assert.ok(styleSource.includes(color));

console.log("Confiance UI : quatre statuts, original, avertissements, sécurité et annonce vocale validés.");
