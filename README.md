# SAFINUM

Prototype d’extension Chrome qui adapte l’affichage d’un service financier existant en français ou en anglais, sans modifier son code source. L’extension détecte la langue de la page à partir de son attribut `lang`, puis des expressions reconnues dans le dictionnaire. Le mode Eton reste hors de l’interface pour le moment.

L’extension utilise le dictionnaire `data/dictionary.json`. Les montants et autres informations sensibles sont préservés. Si un texte ne peut pas être traduit, il reste dans sa langue d’origine et un avertissement invite l’utilisateur à le comprendre avant de continuer. Le rail latéral donne accès au choix de langue, à la lecture vocale et à l’agrandissement du contenu.

Les 60 traductions Eton du parcours financier et du bandeau de démonstration ont été renseignées à partir de l’ouvrage de référence *Dictionnaire éton – français* (Mark Van de Velde et Kisito Essele Essele, Éditions CLÉ, 2022). Les correspondances lexicales, les règles grammaticales et les tons ont été appliqués avec précision. La synthèse automatique reste désactivée en mode Eton en attendant des enregistrements natifs validés. En français et en anglais, le navigateur ne lit qu’avec une voix qu’il signale comme locale; si aucune voix locale correspondante n’est installée, la lecture ne démarre pas.

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
