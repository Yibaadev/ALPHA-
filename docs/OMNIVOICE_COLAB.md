# Voix éton provisoires avec OmniVoice (Google Colab)

En attendant les enregistrements du locuteur, ALPHA peut utiliser des **clips audio éton générés à l’avance** par [OmniVoice](https://github.com/k2-fsa/OmniVoice) (k2-fsa, licence Apache-2.0, langue `eto`).

Le modèle tourne **une seule fois, sur Google Colab**. L’extension ne contient aucun modèle et n’envoie rien : elle lit seulement des fichiers audio. Ces voix sont **provisoires** : le locuteur doit les valider, et ses propres enregistrements les remplaceront.

## Ce qu’il faut

- Un compte Google (Colab et Drive sont gratuits).
- Le fichier `tools/omnivoice_eton_colab.ipynb` du projet.
- Facultatif : un extrait de **3 à 10 secondes** de la voix du locuteur, en éton, enregistré sans bruit, **avec son accord**.

## Étapes

### Sur votre PC

1. Dans le dossier ALPHA, exportez les textes à faire lire :
   ```
   node tools/export-eton-tts.js
   ```
   Cela crée `docs/audio/eton-tts.jsonl` (195 textes aujourd’hui) avec :
   - les textes éton validés du dictionnaire ;
   - les phrases validées du guide « ? », avec les noms de boutons éton déjà insérés ;
   - les termes et les définitions validés d’« Expliquer ».

   Les textes avec une valeur variable (montant, nom) sont écartés, car ils changent à chaque fois. La commande indique combien de textes sont **nouveaux**, combien sont **à régénérer** (leur texte a été corrigé) et combien sont **déjà prêts**.

### Sur Google Colab

2. Ouvrez [colab.research.google.com](https://colab.research.google.com), puis **Fichier → Importer un notebook → Importer**, et choisissez `tools/omnivoice_eton_colab.ipynb`.
3. Menu **Exécution → Modifier le type d’exécution → GPU T4 → Enregistrer**.
4. Lancez les cellules **une par une, dans l’ordre** (bouton ▶) :

| Étape | Ce qui se passe | Durée |
|---|---|---|
| 1. GPU | Vérifie qu’un GPU est actif. | quelques secondes |
| 2. Installation | Installe OmniVoice. Si Colab demande de redémarrer la session, acceptez, puis reprenez à l’étape 3. | 2 à 4 min |
| 3. Dossier | Connecte Google Drive (dossier `ALPHA_omnivoice`) pour ne rien perdre en cas de coupure. | quelques secondes |
| 4. Textes | Envoyez `docs/audio/eton-tts.jsonl`. | quelques secondes |
| 5. Modèle | Télécharge et charge OmniVoice. | 1 à 2 min |
| 6. Voix | **Option A** : voix du locuteur, à partir de son extrait. **Option B** : 4 voix de synthèse à écouter. | 1 min |
| 6 bis | Notez le numéro de la voix choisie (option B). Elle sera la même pour tous les clips. | quelques secondes |
| 7. Génération | Fabrique tous les clips (WAV, puis OGG léger). Si Colab se coupe, relancez la cellule : les clips déjà faits sont gardés. | environ 3 à 5 min |
| 7 bis. Écoute | Le locuteur écoute chaque clip et remplit `revue_locuteur.csv` (`oui` ou `non`, et une remarque). | selon le locuteur |
| 8. Téléchargement | Télécharge `alpha_eton_omnivoice.zip`. | quelques secondes |

### De retour sur votre PC

5. Décompressez `alpha_eton_omnivoice.zip` dans `data/audio/eton/omnivoice/` du projet.
6. Gardez `revue_locuteur.csv` avec les clips : seuls les clips marqués `oui` seront utilisés par l’extension.
7. Reconstruisez l’index lu par l’extension :
   ```
   npm run audio:index          (clips marqués « oui » seulement)
   npm run audio:index:essai    (pour tester : ajoute les clips pas encore écoutés)
   ```
   Un clip dont le texte a été corrigé depuis sa génération est écarté automatiquement (« périmé »). Le texte concerné reste muet jusqu’à ce que son clip soit refait.

## Relancer après une correction des textes

Deux cas :

- **Tout refaire avec une seule voix**, c'est le cas aujourd'hui : `npm run audio:export:tout`. Les 195 clips sont marqués « à régénérer », soit environ 5 à 10 minutes sur un T4.
- **Ne refaire que ce qui a changé** : `npm run audio:export`.

Ensuite :

1. Envoyez le nouveau `docs/audio/eton-tts.jsonl` à l'étape 4. L'étape 4 efface d'elle-même les anciens clips concernés sur le Drive.
2. À l'étape 6 bis, gardez la même voix pour tous les clips. La première génération utilisait la **synthèse n°4** (`VOIX_CHOISIE = 4`).
3. À l'étape 7 bis, la feuille de revue garde les réponses déjà données pour les textes inchangés.
4. Sur votre PC, décompressez le zip dans `data/audio/eton/omnivoice/`, puis lancez `npm run audio:index:essai` (ou `npm run audio:index` une fois la revue faite).

**Ce qui est couvert.** Tout texte éton que l'extension peut afficher a sa voix :

- les entrées du dictionnaire ;
- les phrases modèles, avec leurs morceaux fixes autour des montants et des noms ;
- le guide, la bulle et « Expliquer ».

Une phrase affichée est découpée en morceaux enregistrés. Seuls les montants, les noms et les mots restés en français ne sont pas lus. Le test `npm run test:eton-coverage` le vérifie.

## Bonnes pratiques

- **L’éton est une langue à tons, et OmniVoice n’en a appris que 7,4 heures.** Un clip peut mal placer un ton : la revue du locuteur est indispensable.
- **N’imitez la voix du locuteur qu’avec son accord explicite.**
- Les mots très courts (« Táŋ ») sortent parfois mal : le locuteur peut les marquer `non`, ils seront lus autrement.
- Les enregistrements du locuteur iront dans `data/audio/eton/locuteur/`, avec **le même nom de fichier** : ils passeront toujours avant les clips OmniVoice.
- Outil à déclarer au jury : *OmniVoice (k2-fsa), utilisé hors ligne pour produire des voix éton provisoires ; aucun modèle n’est embarqué dans l’extension.*
