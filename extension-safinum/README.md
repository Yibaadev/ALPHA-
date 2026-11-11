# SAFINUM - Interface en langue locale (prototype)

Extension Chrome qui affiche un service financier numérique dans une langue nationale du Cameroun, **sans modifier le code du site**. Elle lit les textes affichés, les remplace par une version validée par un locuteur, et vérifie que les montants et les informations sensibles n'ont pas changé.

Projet de l'équipe Alpha pour le SAFINUM Innovate Challenge. Rendu : samedi 14 novembre 2026, 23h59.

## Comment ça marche

1. L'extension repère chaque texte de la page (et son menu, ses champs, ses boutons).
2. Les **valeurs sensibles** (montants, numéros de compte et de téléphone, références, dates, noms) sont mises de côté et remplacées par un marqueur : `25 000 FCFA` devient `[M1]`.
3. Le texte avec marqueurs est cherché dans le **dictionnaire** (`data/dictionary.json`).
4. La traduction est affichée, les valeurs d'origine sont **remises telles quelles**.
5. **Contrôle automatique** : si un marqueur manque ou si une valeur n'est pas identique, le texte d'origine est conservé et le panneau l'indique.
6. Un texte absent du dictionnaire reste **tel quel** : l'extension n'invente jamais de traduction.

## Installer l'extension dans Chrome

1. Ouvrir `chrome://extensions`.
2. Activer le **Mode développeur** (en haut à droite).
3. Cliquer sur **Charger l'extension non empaquetée** et choisir le dossier `extension-safinum`.
4. Ouvrir la page de test : https://safinum.cm/hackathon-test
5. Le panneau **Langue de l'interface** apparaît en bas à droite.

Après chaque modification : revenir sur `chrome://extensions`, cliquer sur le bouton de rechargement de l'extension, puis rafraîchir la page de test.

## Structure du dossier

```
extension-safinum/
  manifest.json        configuration de l'extension (site visé, fichiers injectés)
  src/
    protect.js         mise de côté et remise des valeurs sensibles
    translate.js       recherche dans le dictionnaire
    content.js         lecture de la page, panneau de contrôle
  data/
    dictionary.json    les textes : français, anglais, langue locale
  tools/
    check.js           contrôle du dictionnaire
    csv.js             export / import CSV pour le locuteur
    test.js            tests automatiques
  docs/                notes pour la note technique, fichier CSV
```

## Remplir le dictionnaire avec le locuteur

Le locuteur n'a pas besoin du code : il travaille dans un tableur.

```
node tools/csv.js export                       # crée docs/dictionnaire.csv
# le locuteur remplit les colonnes anglais, langue_locale et note
node tools/csv.js import docs/dictionnaire.csv # remet les traductions dans le dictionnaire
node tools/check.js                            # vérifie que tout est cohérent
```

Règles pour les traductions :
- Traduire des **phrases entières**, jamais mot à mot.
- Garder les marqueurs `[M1]`, `[M2]`... dans la traduction : ils représentent une valeur (montant, nom, numéro) qui sera remise à cet endroit. L'ordre peut changer, mais chaque marqueur doit apparaître une fois.
- Respecter les **accents et les tons** de la langue, partout de la même façon.
- Les lignes marquées « AVERTISSEMENT DE SÉCURITÉ » doivent avoir un sens exact : une erreur est un défaut majeur d'après le règlement.
- Pour changer le nom du bouton de la langue, modifier `meta.localLanguage.label` dans `dictionary.json`.

## Compléter la liste des textes

Dans le panneau, le bouton **Copier les textes inconnus** copie tous les textes de la page absents du dictionnaire. Parcourez tout le trajet (les 5 écrans, le bouton EN du site, les erreurs), copiez la liste, puis ajoutez les lignes manquantes dans `dictionary.json`.

## Tests

```
node tools/test.js    # protection des valeurs et recherche dans le dictionnaire
node tools/check.js   # contrôle du dictionnaire
```

## Organisation de l'équipe

- Une branche par personne (par exemple `extension`, `traduction`, `voix`), puis fusion dans `main` quand une partie fonctionne.
- **Ne jamais envoyer un secret sur GitHub** : clés d'API et fichiers `.env` sont exclus par `.gitignore`.
- Écrire la note technique au fil de l'eau, quelques lignes par jour, dans `docs/`.

## Limites connues (à reprendre dans la note technique)

- Les noms de personnes sont protégés grâce à la liste `meta.names` du dictionnaire. Un nom nouveau, absent de cette liste, laisse le texte qui le contient en français.
- Un texte absent du dictionnaire n'est pas traduit (le modèle d'IA pour les textes inédits n'est pas encore branché).
- La voix n'est pas encore intégrée.
- L'extension agit uniquement sur `https://safinum.cm/*` (voir `manifest.json` pour changer le site visé).

## Composants utilisés

Aucune bibliothèque externe pour l'extension (JavaScript, HTML et CSS natifs). À compléter au fil du projet : modèle de synthèse vocale, modèle d'IA, dictionnaires consultés, avec leurs licences.
