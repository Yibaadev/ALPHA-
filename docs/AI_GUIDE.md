# Assistant contextuel ALPHA

ALPHA propose deux actions, déclenchées uniquement par l’utilisateur :

- **Expliquer** : expliquer le passage sélectionné.
- **Me guider** : résumer les repères visibles de la page et proposer une prochaine étape si elle est clairement justifiée.

Le guide ne clique pas, ne remplit pas de champ et ne confirme aucune opération. Les réponses du modèle sont des explications, pas des conseils financiers.

## Données transmises

Le script de contenu prépare un petit contexte depuis des titres, des étapes accessibles, des alertes, des libellés de champs et des actions visibles. Il n’inclut pas les valeurs de formulaire, les captures d’écran, l’URL, les paragraphes de la page ou les contenus cachés. Les motifs courants pour courriels, références, montants, téléphones et longues suites de chiffres sont masqués; la sélection est refusée si ces motifs y sont détectés.

Ce filtrage réduit le risque, mais ne garantit pas la détection de tous les noms ou de toutes les données propres à un site. L’interface avertit donc de ne pas utiliser de données financières réelles. Pour le prototype, utiliser uniquement l’environnement de test et des données fictives. La clé Gemini n’est jamais incluse dans l’extension.

## Proxy local de développement

Le proxy écoute uniquement sur `127.0.0.1`, exige l’identifiant exact de l’extension, limite le débit et la taille des requêtes, n’enregistre pas les prompts et désactive Gemini par défaut. Il est destiné aux essais locaux; il ne constitue pas un proxy de production multi-utilisateur.

1. Charger l’extension non empaquetée dans Chrome et relever son identifiant dans `chrome://extensions`.
2. Copier `.env.example` vers `.env.local` et renseigner `GEMINI_API_KEY` depuis Google AI Studio, `ALPHA_EXTENSION_ID`, puis mettre `ALPHA_AI_ENABLED=true`.
3. Lancer avec Node.js 20.6 ou plus récent :

   ```powershell
   node --env-file=.env.local server/gemini-proxy.mjs
   ```

4. Recharger l’extension et utiliser les actions **Expliquer** ou **Me guider** dans l’environnement fictif.

Le modèle est configurable avec `GEMINI_MODEL`; le défaut est `gemini-3.8-flash`. Les quotas gratuits sont limités et peuvent changer. Selon les conditions actuelles de Google, les requêtes de l’offre gratuite peuvent être utilisées pour améliorer ses produits. Ne pas y envoyer de données financières réelles.

## Avant toute distribution

Déployer un proxy HTTPS contrôlé par le projet, remplacer l’adresse de développement dans `src/background.js` et les permissions d’hôte du manifeste, puis ajouter une authentification utilisateur, des quotas par compte, une politique de conservation et une gestion des abus. Ne jamais placer la clé Google dans le code client ou dans Git. Revoir les conditions de traitement des données de Google avant d’envoyer du contenu confidentiel.

Les voix Éton ne sont pas encore intégrées. Le texte d’aide est disponible en français ou en anglais; la voix locale du navigateur peut prononcer la réponse dans ces langues. Les réponses Éton et leurs voix seront activées après validation linguistique et technique.
