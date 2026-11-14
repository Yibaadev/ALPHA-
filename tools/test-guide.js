// Tests du guide « ? » (src/guide.js) : reconnaissance des écrans, libellés cités,
// alertes, guide automatique pour un écran inconnu, bulle de présentation.
// Lancer : node tools/test-guide.js
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const context = vm.createContext({ console });
vm.runInContext(fs.readFileSync(path.join(root, "src/guide.js"), "utf8"), context, { filename: "src/guide.js" });
const G = context.ALPHA.guide;
const data = JSON.parse(fs.readFileSync(path.join(root, "data/guide.json"), "utf8"));
G.init(data);

// Élément relevé sur la page : texte d'origine, et texte affiché (traduit ou non).
const item = (kind, orig, shown, extra) => Object.assign({ kind, orig, shown: shown || orig }, extra || {});
const snap = (items, title) => ({ title: title || "", items });

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

const SCREENS = {
  dashboard: [item("text", "Votre compte"), item("text", "Solde disponible"), item("button", "Effectuer un transfert"), item("button", "Consulter les frais")],
  fees: [item("text", "Frais de transfert"), item("text", "Type d'opération"), item("text", "Montant à envoyer"), item("text", "Total à débiter"), item("button", "Continuer")],
  beneficiary: [item("text", "Nom du bénéficiaire"), item("text", "Numéro de téléphone"), item("text", "Motif du transfert"), item("button", "Continuer")],
  summary: [item("text", "Récapitulatif"), item("text", "Total débité"), item("text", "Référence"), item("button", "Confirmer le transfert"), item("button", "Modifier")],
  receipt: [item("text", "Transfert effectué"), item("text", "Total débité"), item("text", "Référence"), item("text", "Statut"), item("button", "Nouveau transfert")],
};

test("les 5 écrans du site de test sont reconnus", () => {
  for (const [id, items] of Object.entries(SCREENS)) {
    assert.strictEqual(G.build(snap(items), "fr", "fr").screen, id, id);
  }
});

test("écran reconnu même quand le site est en anglais", () => {
  const items = [item("text", "Transfer fees"), item("text", "Operation type"), item("text", "Amount to send"), item("button", "Continue")];
  const guide = G.build(snap(items), "en", "en");
  assert.strictEqual(guide.screen, "fees");
  assert.strictEqual(guide.lang, "en");
  assert.ok(guide.how.includes("“Continue”"), guide.how);
});

test("écran reconnu par le texte d'origine quand la page est traduite", () => {
  // Site en français affiché en anglais par ALPHA : les repères restent les textes d'origine.
  const items = [
    item("text", "Frais de transfert", "Transfer fees"),
    item("text", "Type d'opération", "Operation type"),
    item("button", "Continuer", "Continue"),
  ];
  const guide = G.build(snap(items), "en", "fr");
  assert.strictEqual(guide.screen, "fees");
  assert.ok(guide.how.includes("“Continue”"), "le guide cite le libellé affiché : " + guide.how);
});

test("un seul repère ne suffit pas : pas de faux écran", () => {
  assert.strictEqual(G.build(snap([item("text", "Votre compte")]), "fr", "fr").screen, null);
});

test("le guide cite les boutons tels qu'ils sont affichés", () => {
  const guide = G.build(snap(SCREENS.summary), "fr", "fr");
  assert.ok(guide.how.includes("« Confirmer le transfert »"), guide.how);
  assert.ok(guide.how.includes("« Modifier »"), guide.how);
  assert.ok(!/\{\w+\}/.test(guide.where + guide.what + guide.how), "clé non remplacée");
});

test("aucun écran connu ne laisse de clé {…} non remplacée, en français et en anglais", () => {
  for (const lang of ["fr", "en"]) {
    for (const items of Object.values(SCREENS)) {
      const g = G.build(snap(items), lang, "fr");
      assert.ok(!/\{\w+\}/.test(g.where + g.what + g.how + g.tip + g.speech), g.how);
    }
  }
});

test("en éton : guide en français, signalé comme en attente de validation", () => {
  const items = SCREENS.summary.map((i) => Object.assign({}, i, { shown: "ÉTON " + i.orig }));
  const guide = G.build(snap(items), "local", "fr");
  assert.strictEqual(guide.lang, "fr");
  assert.ok(/attente de validation/.test(guide.note), guide.note);
  // À l'écran : le libellé affiché (éton). À voix haute : le libellé d'origine, lisible par une voix française.
  assert.ok(guide.how.includes("ÉTON Confirmer le transfert"), guide.how);
  assert.ok(!guide.speech.includes("ÉTON"), guide.speech);
});

test("alerte connue du site : citée telle quelle, avec un conseil", () => {
  const items = SCREENS.beneficiary.concat(item("alert", "Alerte de sécurité : vérifiez le numéro du bénéficiaire avant de continuer."));
  const guide = G.build(snap(items), "fr", "fr");
  assert.ok(guide.alert, "alerte absente");
  assert.ok(guide.alert.text.includes("vérifiez le numéro"));
  assert.ok(/cochez la case de vérification/.test(guide.alert.advice), guide.alert.advice);
  assert.ok(guide.speech.includes(guide.alert.advice));
});

test("alerte inconnue (contenu inédit) : citée, avec un conseil prudent", () => {
  const items = [item("alert", "Attention : maintenance prévue ce soir à 22 h.")];
  const guide = G.build(snap(items), "fr", "fr");
  assert.ok(guide.alert.text.includes("maintenance"));
  assert.strictEqual(guide.alert.advice, data.ui.fr.unknownAlert);
});

test("écran inconnu : titre, champs, cases, bouton principal", () => {
  const items = [
    item("heading", "Payer une facture"),
    item("field", "Numéro de contrat"),
    item("field", "Montant"),
    item("check", "J'accepte les conditions"),
    item("button", "Annuler"),
    item("button", "Payer maintenant", null, { primary: true }),
  ];
  const guide = G.build(snap(items), "fr", "fr");
  assert.strictEqual(guide.known, false);
  assert.strictEqual(guide.where, "Page « Payer une facture ».");
  assert.ok(guide.what.includes("« Numéro de contrat », « Montant »"), guide.what);
  assert.ok(guide.what.includes("« J'accepte les conditions »"), guide.what);
  assert.ok(guide.how.startsWith("Ensuite, appuyez sur « Payer maintenant »."), guide.how);
  assert.ok(guide.how.includes("« Annuler »"), guide.how);
});

test("écran inconnu sans titre ni bouton : rien d'inventé", () => {
  const guide = G.build(snap([item("text", "Bonjour")]), "fr", "fr");
  assert.ok(/sans titre/.test(guide.where), guide.where);
  assert.strictEqual(guide.how, data.ui.fr.noButton);
});

test("champ de code secret : conseil de sécurité", () => {
  const items = [item("heading", "Validation"), item("field", "Code reçu par SMS", null, { secret: true }), item("button", "Valider", null, { primary: true })];
  const guide = G.build(snap(items), "fr", "fr");
  assert.strictEqual(guide.tip, data.ui.fr.secretTip);
});

test("le guide ne modifie aucune valeur citée (montant dans un titre)", () => {
  const items = [item("heading", "Payer 12 500 FCFA à Paul Atangana"), item("button", "Payer", null, { primary: true })];
  const guide = G.build(snap(items), "en", "fr");
  assert.ok(guide.where.includes("Payer 12 500 FCFA à Paul Atangana"), guide.where);
});

test("bulle de présentation : français par défaut, anglais pour une page anglaise", () => {
  assert.strictEqual(G.intro("fr", "fr").title, data.intro.fr.title);
  assert.strictEqual(G.intro("original", "en").title, data.intro.en.title);
  assert.strictEqual(G.intro("local", "fr").title, data.intro.fr.title);
  assert.ok(G.intro("fr", "fr").lines.length >= 2);
});

console.log(passed + " test(s) guide réussi(s).");
