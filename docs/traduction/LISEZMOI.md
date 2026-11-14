# Traduire le guide en éton (Gemini + locuteur)

Ce dossier contient la traduction éton du guide « ? », de la bulle « Moi, c'est ALPHA ! » et du glossaire « Expliquer ».
Gemini est utilisé **hors de l'extension**, sur le site de Google, et ne propose qu'une première version. C'est le locuteur qui valide.
L'extension ne contient aucun modèle d'IA et n'envoie rien.

## 1. Préparer le texte pour Gemini

```
npm run eton:prompt
```

Cette commande écrit `PROMPT_GEMINI.md`. Ce fichier contient les consignes, les 99 mots éton déjà validés du dictionnaire et les 89 textes à traduire.

## 2. Traduire avec Gemini

1. Ouvrez https://gemini.google.com (ou https://aistudio.google.com) et choisissez le modèle le plus avancé proposé.
2. Copiez **tout** le contenu de `PROMPT_GEMINI.md` et envoyez-le.
3. Gemini répond par un bloc JSON. Copiez la réponse et collez-la dans un nouveau fichier `docs/traduction/gemini-eton.json`. Les ```json autour du bloc ne posent pas de problème.

Si la réponse est coupée parce qu'elle est trop longue, demandez « continue » et recollez les deux morceaux dans un seul objet JSON.

## 3. Intégrer la proposition

```
npm run eton:import
```

- Le guide et « Expliquer » s'affichent maintenant en éton, avec la mention « proposé avec l'aide d'une IA de traduction (Google), en cours de vérification par un locuteur ».
- Une traduction qui a perdu un nom de bouton entre accolades, comme `{confirm}`, est refusée. L'écran concerné reste alors en français. La commande affiche la liste de ces cas.
- La commande crée aussi `revue-guide-eton.csv`, la feuille du locuteur.

## 4. Revue par le locuteur

Ouvrez `revue-guide-eton.csv` dans Excel ou Google Sheets. Pour chaque ligne :

- si la proposition est juste, mettez **oui** dans la colonne `correct` ;
- sinon, écrivez la bonne phrase dans la colonne `correction` ;
- si la phrase est fausse et qu'il n'y a pas de correction, mettez **non** : le texte repasse en français.

Enregistrez au format CSV, puis lancez :

```
npm run eton:revue
```

Un bloc, par exemple un écran entier, passe en « valide » quand toutes ses phrases sont validées. La mention « en cours de vérification » disparaît alors.

## Limites

- Le guide automatique des écrans inconnus est construit à partir de la page au moment où on l'affiche. Il reste en français.
- En mode Éton, le guide n'est pas encore lu à voix haute : il faut d'abord des enregistrements éton de ces phrases, faits par le locuteur ou avec OmniVoice.
