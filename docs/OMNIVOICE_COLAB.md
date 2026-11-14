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
   Cela crée `docs/audio/eton-tts.jsonl` (120 textes aujourd’hui) avec :
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

C’est le cas aujourd’hui : le guide a été traduit, et 12 phrases du dictionnaire ont été passées au tutoiement.

1. `node tools/export-eton-tts.js`, puis envoyez le nouveau `eton-tts.jsonl` à l’étape 4.
2. Gardez **le même dossier Drive** et **la même voix**. La première génération utilisait la **synthèse n°4** : mettez `VOIX_CHOISIE = 4` à l’étape 6 bis, sinon les nouveaux clips n’auront pas la même voix que les anciens.
3. L’étape 4 efface d’elle-même les clips dont le texte a changé. L’étape 7 ne génère que ce qui manque, soit 39 clips environ (1 à 2 minutes).
4. À l’étape 7 bis, la feuille de revue garde les réponses déjà données. Seuls les clips nouveaux ou modifiés sont à écouter.

Si le dossier Drive de la première fois n’existe plus, ce n’est pas grave : tout est simplement régénéré, avec la même voix n°4.

## Bonnes pratiques

- **L’éton est une langue à tons, et OmniVoice n’en a appris que 7,4 heures.** Un clip peut mal placer un ton : la revue du locuteur est indispensable.
- **N’imitez la voix du locuteur qu’avec son accord explicite.**
- Les mots très courts (« Táŋ ») sortent parfois mal : le locuteur peut les marquer `non`, ils seront lus autrement.
- Les enregistrements du locuteur iront dans `data/audio/eton/locuteur/`, avec **le même nom de fichier** : ils passeront toujours avant les clips OmniVoice.
- Outil à déclarer au jury : *OmniVoice (k2-fsa), utilisé hors ligne pour produire des voix éton provisoires ; aucun modèle n’est embarqué dans l’extension.*
