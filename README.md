# SAFINUM

Prototype d’extension Chrome qui adapte l’affichage d’un service financier existant, sans modifier son code source. La première langue nationale ciblée est l’Eton (Ìtón, code `eto`).

L’extension utilise le dictionnaire `data/dictionary.json`. Les montants et autres informations sensibles sont préservés. Si un texte n’est pas dans le dictionnaire, il reste inchangé et peut être copié pour compléter le dictionnaire. Le rail latéral donne accès au choix de langue, au suivi du parcours, aux contrôles de valeurs et à la lecture vocale locale du texte visible.

Les 57 traductions Eton du parcours financier restent à renseigner et à valider par une personne compétente avant une démonstration linguistique. L’interface signale ces entrées comme étant à valider et ne présente pas de texte financier inventé comme une traduction correcte. La synthèse automatique est désactivée en mode Eton en attendant des enregistrements natifs validés. En français et en anglais, le navigateur ne lit qu’avec une voix qu’il signale comme locale; si aucune voix locale correspondante n’est installée, la lecture ne démarre pas.

## Installation

1. Ouvrir `chrome://extensions` et activer le **Mode développeur**.
2. Cliquer sur **Charger l’extension non empaquetée** et choisir le dossier du projet.
3. Ouvrir [la page de test SAFINUM](https://safinum.cm/hackathon-test).

Après une modification, recharger l’extension dans Chrome puis actualiser la page.

## Dictionnaire

Pour préparer ou mettre à jour les traductions :

```bash
node tools/csv.js export
# Compléter le fichier docs/dictionnaire.csv
node tools/csv.js import docs/dictionnaire.csv
node tools/check.js
```

Conservez les marqueurs comme `[M1]` dans les traductions : ils représentent des valeurs qui seront remises à leur place.

## Vérifications

```bash
node tools/test.js
node tools/check.js
```

## Fichiers principaux

- `manifest.json` : configuration de l’extension.
- `src/` : lecture de la page, traduction et protection des valeurs.
- `data/dictionary.json` : textes et traductions.
- `tools/` : import/export CSV et vérifications.
- `docs/` : documentation et fichiers de traduction.

## Limites

Les textes absents du dictionnaire ne sont pas traduits. La qualité des traductions Eton doit être vérifiée par des locuteurs compétents, en particulier pour les avertissements et les conditions financières. La disponibilité des voix locales en français et en anglais dépend du navigateur et du système. Le prototype ne réalise aucune opération financière.
