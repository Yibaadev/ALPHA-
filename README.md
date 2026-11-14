# ALPHA

Prototype d’extension Chrome qui adapte l’affichage d’un service financier existant en français ou en anglais, sans modifier son code source. Elle propose le français, l’anglais et l’éton. L’extension détecte la langue de la page à partir de son attribut `lang` et de son contenu réel, qui l’emporte quand il le contredit nettement (beaucoup de sites changent de langue sans mettre à jour `lang`).

L’extension utilise le dictionnaire `data/dictionary.json`. Les montants et autres informations sensibles sont préservés. Si un texte ne peut pas être traduit, il reste dans sa langue d’origine et un avertissement invite l’utilisateur à le comprendre avant de continuer. Le rail latéral donne accès au choix de langue, à la lecture vocale et à l’agrandissement du contenu.

Les 60 traductions Eton du parcours financier et du bandeau de démonstration ont été renseignées à partir de l’ouvrage de référence *Dictionnaire éton – français* (Mark Van de Velde et Kisito Essele Essele, Éditions CLÉ, 2022). Les correspondances lexicales, les règles grammaticales et les tons ont été appliqués avec précision. La synthèse automatique reste désactivée en mode Eton en attendant des enregistrements natifs validés. En français et en anglais, le navigateur ne lit qu’avec une voix qu’il signale comme locale; si aucune voix locale correspondante n’est installée, la lecture ne démarre pas.

## Contenu inédit et autres sites

ALPHA analyse la page telle qu’elle est, sans hook ni marqueur fourni par le site, et traduit aussi le texte ajouté après le chargement (contenu injecté, messages d’erreur, alertes). Pour chaque texte, dans l’ordre :

1. **Dictionnaire** (`data/dictionary.json`) : correspondance exacte, y compris les formulations anglaises propres à un site (`en_variants`).
2. **Cascade éton** (gabarits, correspondance approchée, segments, règles) pour le mode Éton.
3. **Traduction hors ligne de secours** (`src/engine/mt.js`), uniquement pour un texte absent du dictionnaire, entre français et anglais. En mode Éton, un texte anglais inédit passe par le français.

La traduction de secours utilise l’API **Translator intégrée à Chrome** (Chrome 138 ou plus récent) : le modèle s’exécute sur l’appareil et aucun texte n’est transmis. Chrome télécharge le modèle une seule fois, après un clic sur une langue dans le panneau. Avant d’être affichée, chaque sortie est contrôlée : les valeurs sensibles sont masquées avant la traduction, et la sortie est refusée si un montant, un chiffre ou une référence change, ou si la négation, un échec ou une alerte disparaît ou apparaît. En cas de refus, ou si le navigateur n’a pas cette API, le texte reste dans sa langue d’origine.

Ne sont jamais modifiés : les champs de saisie et leur réaffichage (nom, motif, note saisis par l’utilisateur), les zones `contenteditable`, les éléments `translate="no"` ou `.notranslate`, le code (`code`, `pre`), les options de liste sans attribut `value` et les boutons `<input>` envoyés avec le formulaire. L’extension traduit aussi les Shadow DOM ouverts et les cadres (iframes), qui suivent la langue choisie dans la page principale.

**Outils déclarés** : API Translator de Chrome (traduction sur l’appareil, aucun service externe). Les formulations françaises et anglaises des messages d’erreur de la page de test Safinum ont été reprises de la page elle-même.

## Installation

1. Ouvrir `chrome://extensions` et activer le **Mode développeur**.
2. Cliquer sur **Charger l’extension non empaquetée** et choisir le dossier du projet.
3. Ouvrir une page Web de démonstration compatible, puis vérifier le panneau ALPHA.

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
npm test
```

Cette commande vérifie la syntaxe des scripts, les données JSON, les moteurs de traduction, les messages inédits et la cohérence du dictionnaire.

## Fichiers principaux

- `manifest.json` : configuration de l’extension.
- `src/content.js` : observation de la page et adaptation du DOM.
- `src/translation-controller.js` : choix de la cascade de traduction, indépendant du DOM.
- `src/engine/` : moteurs linguistiques et utilitaires communs de validation.
- `src/panel.js` : structure et interactions du panneau d’accessibilité.
- `src/panel.css` : styles du Shadow DOM et variables de thème réutilisables.
- `src/voice.js` : lecture vocale avec les voix locales du navigateur.
- `src/protect.js` : protection des valeurs sensibles.
- `data/dictionary.json` : textes et traductions.
- `tools/` : import/export CSV et vérifications.
- `docs/` : documentation et fichiers de traduction.

## Limites

Sans l’API Translator de Chrome, les textes absents du dictionnaire ne sont pas traduits en français ni en anglais. En mode Éton, un texte inédit que la cascade ne sait pas traduire sans risque reste en français. La qualité des traductions Eton doit être vérifiée par des locuteurs compétents, en particulier pour les avertissements et les conditions financières. La disponibilité des voix locales en français et en anglais dépend du navigateur et du système. Le prototype ne réalise aucune opération financière.
