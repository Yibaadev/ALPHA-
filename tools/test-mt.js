// Tests du contenu inédit : traduction locale de secours (src/engine/mt.js),
// détection de langue et variantes anglaises du dictionnaire.
// Lancer : node tools/test-mt.js
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");

// Faux traducteur Chrome : renvoie la sortie préparée pour chaque texte masqué.
const outputs = new Map();
const FakeTranslator = {
  async availability() { return "available"; },
  async create() {
    return { async translate(text) { return outputs.has(text) ? outputs.get(text) : text; } };
  },
};

const context = vm.createContext({ console, Translator: FakeTranslator, setTimeout });
for (const file of [
  "src/protect.js", "src/confidence.js", "src/engine/common.js", "src/engine/templates.js", "src/engine/fuzzy.js",
  "src/engine/segments.js", "src/engine/rules.js", "src/engine/language.js", "src/translate.js", "src/engine/mt.js",
]) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
}
const { translate: T, mt: MT } = context.ALPHA;
const data = (name) => require(path.join(root, "data", name));
T.init(data("dictionary.json"), {
  criticalTerms: data("critical_terms.json"), templates: data("templates.json"),
  lexicon: data("lexicon.json"), rules: data("rules.json"),
});

let passed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed++;
  } catch (e) {
    console.error("ÉCHEC : " + name + "\n  " + e.message);
    process.exitCode = 1;
  }
}

function waitFor(text, src, tgt) {
  return new Promise((resolve) => {
    MT.onResult(() => {
      const value = MT.lookup(text, src, tgt);
      if (value !== undefined) resolve(value);
    });
    const first = MT.lookup(text, src, tgt);
    if (first !== undefined) resolve(first);
  });
}

(async () => {
  const check = (original, output, src = "fr", tgt = "en") => {
    const { masked, values } = T.protectText(original);
    return MT.check(original, masked, values, output, src, tgt);
  };

  // Les valeurs et la polarité doivent rester identiques après traduction.
  await test("traduction correcte acceptée, montant restauré à l'identique", () => {
    assert.strictEqual(
      check("Votre paiement de 12 500 FCFA a été reçu.", "Your payment of [M1] has been received."),
      "Your payment of 12 500 FCFA has been received."
    );
  });
  await test("marqueurs abîmés par le modèle réparés : [ M1 ]", () => {
    assert.strictEqual(check("Total : 3 000 FCFA", "Total: [ M1 ]"), "Total: 3 000 FCFA");
  });
  await test("marqueur perdu : refus", () => {
    assert.strictEqual(check("Frais : 350 FCFA", "Fees: 350 XAF"), null);
  });
  await test("chiffre modifié hors marqueur : refus", () => {
    assert.strictEqual(check("Le code expire dans 4 minutes.", "The code expires in 5 minutes."), null);
  });
  await test("négation perdue : refus", () => {
    assert.strictEqual(check("Ne partagez jamais votre code.", "Always share your code."), null);
  });
  await test("négation ajoutée : refus", () => {
    assert.strictEqual(check("Le transfert a été envoyé.", "The transfer was not sent."), null);
  });
  await test("échec transformé en succès : refus", () => {
    assert.strictEqual(check("Transfert échoué.", "Transfer completed."), null);
  });
  await test("alerte affaiblie : refus", () => {
    assert.strictEqual(check("Alerte : activité suspecte sur votre compte.", "Note: some activity on your account."), null);
  });
  await test("anglais vers français : négation conservée acceptée", () => {
    assert.strictEqual(
      check("Do not share your PIN.", "Ne partagez pas votre code PIN.", "en", "fr"),
      "Ne partagez pas votre code PIN."
    );
  });
  await test("sortie identique à l'entrée : pas de traduction", () => {
    assert.strictEqual(check("Bienvenue chez nous", "Bienvenue chez nous"), null);
  });

  // La chaîne complète utilise le modèle simulé pour tester les contenus inédits.
  await test("contenu inédit traduit de bout en bout, valeurs protégées", async () => {
    const original = "Votre prime de 5 000 FCFA arrive le 20/11/2026.";
    outputs.set(T.protectText(original).masked, "Your bonus of [M1] arrives on [M2].");
    const result = await waitFor(original, "fr", "en");
    assert.strictEqual(result, "Your bonus of 5 000 FCFA arrives on 20/11/2026.");
  });
  await test("contenu inédit refusé : mis en cache comme non traduit (null)", async () => {
    const original = "Aucun frais ne sera prélevé.";
    outputs.set(T.protectText(original).masked, "Fees will be charged.");
    assert.strictEqual(await waitFor(original, "fr", "en"), null);
  });

  // La détection de langue sert de secours quand le dictionnaire ne reconnaît pas le texte.
  await test("langue d'un texte libre", () => {
    assert.strictEqual(T.guessLanguage("Votre demande a été transmise à notre équipe."), "fr");
    assert.strictEqual(T.guessLanguage("Your request has been sent to our team."), "en");
    assert.strictEqual(T.guessLanguage("OK"), null);
  });
  await test("le contenu l'emporte sur un <html lang> contredit nettement", () => {
    const english = Array(6).fill("Your balance is available for the transfer.");
    assert.strictEqual(T.detectPageLanguage("fr", english), "en");
    assert.strictEqual(T.detectPageLanguage("fr", english.slice(0, 2)), "fr");
  });

  // Vérifie les formulations réellement rencontrées dans l'interface de démonstration.
  await test("variantes anglaises du site traduites vers le français", () => {
    for (const [en, fr] of [
      ["Fee", "Frais"],
      ["Edit", "Modifier"],
      ["Security warning: verify the beneficiary phone number before continuing.",
        "Alerte de sécurité : vérifiez le numéro du bénéficiaire avant de continuer."],
      ["Insufficient balance for this transfer.", "Solde insuffisant pour effectuer ce transfert."],
    ]) {
      const result = T.analyse(en, "fr", "en");
      assert.strictEqual(result.kind, "ok", en);
      assert.strictEqual(result.text, fr);
    }
  });
  await test("messages d'erreur du parcours traduits vers l'anglais", () => {
    const result = T.analyse("Le montant doit être supérieur à zéro.", "en", "fr");
    assert.strictEqual(result.kind, "ok");
    assert.strictEqual(result.text, "The amount must be greater than zero.");
  });

  // Les noms inconnus sont protégés, tandis que les titres de boutons restent traduisibles.
  await test("repérage des noms propres, sans confondre titres et débuts de phrase", () => {
    const names = (t) => Array.from(context.ALPHA.protect.detectNames(t));
    assert.deepStrictEqual(names("Bénéficiaire : Marie-Claire Essomba"), ["Marie-Claire Essomba"]);
    assert.ok(names("Envoyés à Paul Atangana.").includes("Paul Atangana"));
    assert.deepStrictEqual(names("Transfer sent to Paul."), ["Paul"]);
    assert.deepStrictEqual(names("Make A Transfer Now"), []);
    assert.deepStrictEqual(names("Le Service Client vous répond"), []);
    assert.deepStrictEqual(names("Mobile money"), []);
  });
  await test("gabarits éton appliqués avec un nom inconnu, nom recopié à l'identique", () => {
    for (const [fr, name] of [
      ["Transfert effectué : 10 000 FCFA envoyés à Paul Atangana.", "Paul Atangana"],
      ["Le transfert vers Marie-Claire Essomba est programmé pour le 12/11/2026.", "Marie-Claire Essomba"],
      ["Bénéficiaire : Rose Ngono", "Rose Ngono"],
    ]) {
      const result = T.translate(fr, { target: "eton" });
      assert.ok(result.eton, "non traduit : " + fr);
      assert.ok(result.eton.includes(name), "nom altéré : " + result.eton);
    }
  });
  await test("piège effectué/échoué toujours refusé avec un nom inconnu", () => {
    const result = T.translate("Transfert échoué : 10 000 FCFA envoyés à Paul Atangana.", { target: "eton" });
    assert.strictEqual(result.eton, null);
  });
  await test("traduction hors ligne : le nom n'est jamais confié au modèle", async () => {
    const original = "Votre transfert vers Rose Blanche est prêt.";
    const masked = T.protectText(original).masked;
    assert.ok(!masked.includes("Rose Blanche"), "nom non masqué : " + masked);
    outputs.set(masked, masked.replace("Votre transfert vers", "Your transfer to").replace("est prêt.", "is ready."));
    assert.strictEqual(await waitFor(original, "fr", "en"), "Your transfer to Rose Blanche is ready.");
  });

  console.log(passed + " test(s) contenu inédit réussi(s).");
})();
