# SAFINUM

Prototype d’extension Chrome qui traduit l’interface de SAFINUM dans une langue locale du Cameroun.

L’extension utilise le dictionnaire `data/dictionary.json`. Les montants et autres informations sensibles sont préservés. Si un texte n’est pas dans le dictionnaire, il reste inchangé.

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

Les textes absents du dictionnaire ne sont pas traduits. La voix n’est pas encore intégrée. L’extension fonctionne sur `https://safinum.cm/*`.
