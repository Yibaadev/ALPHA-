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

## Guide de l’écran (« ? »)

Le bouton **?** de la barre latérale explique l’écran affiché en trois réponses courtes : **Où suis-je ?**, **Que faire ?**, **Comment ?**. Le bouton **Écouter le guide** les lit à voix haute.

- **Écrans connus** (tableau de bord, frais, bénéficiaire, récapitulatif, reçu de la page de test Safinum) : textes rédigés à l’avance dans `data/guide.json`. L’écran est reconnu à partir des textes d’origine de la page, même quand ALPHA les a traduits, et le guide cite les boutons tels qu’ils sont affichés.
- **Autres écrans et autres sites** : le guide est construit à partir des éléments visibles (titre, champs à remplir, cases à cocher, bouton principal). Il ne cite que des libellés présents sur la page et n’invente rien.
- **Alertes** : une alerte affichée par le site est reprise telle quelle. Pour les messages connus du parcours, un conseil s’y ajoute (par exemple « Cochez la case de confirmation… »). Un champ de code secret (code SMS, PIN, mot de passe) déclenche un rappel de sécurité.
- **Éton** : les champs `local` de `data/guide.json` attendent des textes validés par un locuteur. D’ici là, le guide s’affiche et se lit en français, et le panneau le signale.

À la première visite, une bulle « Moi, c’est ALPHA ! » présente le drapeau flottant à côté de la carte. Elle ne revient plus une fois fermée, et son texte reste disponible en bas du guide.

## Expliquer un terme

Quand l’utilisateur sélectionne un texte de la page qui contient un terme financier connu (frais, solde, bénéficiaire, référence, total débité, Mobile Money…), un bouton **Expliquer** apparaît à côté. Il ouvre une courte explication, lisible à voix haute. Les explications viennent d’un glossaire vérifié (`data/glossary.json`, 24 termes en français et en anglais), pas d’un modèle d’IA : rien n’est inventé et rien ne sort de l’appareil. En mode Éton, le terme d’origine est reconnu sous le texte traduit ; l’explication s’affiche en français tant que sa version éton n’est pas validée. Le bouton n’apparaît jamais dans un champ de saisie, ni sur une sélection sans terme connu.

Le guide lit la page en mémoire, sur l’appareil. Il ne stocke ni ne transmet aucun texte de la page. La lecture vocale n’utilise que des voix installées sur l’appareil (`localService`) : les voix « en ligne » de certains navigateurs enverraient le texte lu à un serveur.

**Outils déclarés** : API Translator de Chrome (traduction sur l’appareil, aucun service externe) ; synthèse vocale du navigateur (Web Speech API), limitée aux voix locales. **Aucun modèle d’IA générative** n’est utilisé et l’extension n’envoie aucun texte de la page à un service externe. Un prototype d’assistant Gemini en ligne a été écarté de cette version pour respecter la règle de non-transmission des données affichées ; il est conservé à part dans la branche `experimental-gemini`. Les formulations françaises et anglaises des messages d’erreur de la page de test Safinum ont été reprises de la page elle-même.

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
- `src/voice.js` : lecture vocale (page et guide) avec les voix locales du navigateur.
- `src/protect.js` : protection des valeurs sensibles.
- `src/guide.js` et `data/guide.json` : guide « ? » de l’écran (reconnaissance de l’écran, textes, bulle de présentation).
- `src/guide-controller.js` : relevé de la page pour le guide, rafraîchissement et lecture.
- `src/panel-guide.js` : section guide et bulle de présentation du panneau.
- `src/explain.js`, `src/explain-controller.js`, `src/panel-explain.js` et `data/glossary.json` : action « Expliquer » (glossaire, sélection, carte d’explication).
- `src/panel-help.css` : styles du guide, de la bulle et de « Expliquer ».
- `data/dictionary.json` : textes et traductions.
- `tools/` : import/export CSV et vérifications.
- `docs/` : documentation et fichiers de traduction.

## Limites

Sans l’API Translator de Chrome, les textes absents du dictionnaire ne sont pas traduits en français ni en anglais. En mode Éton, un texte inédit que la cascade ne sait pas traduire sans risque reste en français. La qualité des traductions Eton doit être vérifiée par des locuteurs compétents, en particulier pour les avertissements et les conditions financières. La disponibilité des voix locales en français et en anglais dépend du navigateur et du système. Le prototype ne réalise aucune opération financière.
