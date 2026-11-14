# ALPHA

Extension Chrome qui affiche un service financier en ligne en **éton**, en **français** ou en **anglais**, sans modifier le code du site. Elle ne touche jamais aux montants, numéros, noms ni références.

Projet présenté au hackathon **SAFINUM Innovate 2026**.

## Essayer l'extension

1. Ouvrez `chrome://extensions` et activez le **Mode développeur**.
2. Cliquez sur **Charger l'extension non empaquetée** et choisissez :
   - le dossier **`extension/`** si vous avez récupéré le projet depuis GitHub. Ne choisissez pas la racine du dépôt.
   - le dossier décompressé, si vous avez reçu le fichier `alpha-extension.zip`.
3. Ouvrez le site de test Safinum, puis cliquez sur la carte du Cameroun qui flotte à droite.

## Fonctionnalités

- **Traduction de la page** : FR, EN ou ET au choix. ALPHA n'intervient que sur demande. Un second clic sur la langue active rend la page au site, dont le propre bouton de langue reste utilisable.
- **Valeurs protégées** : un montant, un numéro ou une référence ne change jamais. Si une traduction risque d'en modifier une, elle est refusée et le texte d'origine reste affiché avec un avertissement.
- **Messages nouveaux** : les messages qui apparaissent pendant l'utilisation sont aussi traduits (erreurs, alertes, confirmations). Pour cela, ALPHA s'appuie sur une banque d'environ 160 messages bancaires courants.
- **Guide « ? »** : il explique l'écran affiché (où suis-je, que faire, comment), en éton comme en français.
- **Lecture au clic** : seul le texte touché est lu. En éton, ALPHA utilise des voix éton préenregistrées et ne lit jamais en français. Pendant la lecture, les clics ne déclenchent rien sur le site.
- **Agrandissement** de l'affichage. Le panneau est utilisable au clavier et sur téléphone.

## Confidentialité

ALPHA ne collecte, ne stocke et ne transmet aucune donnée de la page. Tout se passe sur l'appareil. La lecture vocale n'utilise que des voix installées localement, et l'extension ne contient aucun modèle d'IA.

## Langue éton

Les traductions s'appuient sur le *Dictionnaire éton – français* (Van de Velde et Essele Essele, Éditions CLÉ, 2022). Elles sont validées par notre locuteur : un texte éton n'est affiché qu'une fois validé.

**Outils utilisés pour préparer les contenus, hors de l'extension :**
- Gemini a proposé une première traduction des textes fixes, ensuite corrigée et validée par le locuteur.
- OmniVoice a produit les voix éton, une seule fois, sur Google Colab.

Dans l'extension, la traduction française et anglaise de secours utilise l'API Translator de Chrome, qui fonctionne sur l'appareil.

## Organisation du projet

```
extension/   l'extension (seul dossier chargé par Chrome et livré)
content/     sources linguistiques : lexique, traductions, voix en préparation
scripts/     outils de l'équipe (paquet, voix, traduction)
tests/       vérifications automatiques
docs/        documentation détaillée
```

Pour les développeurs :
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) : le fonctionnement interne ;
- [docs/TRADUCTION.md](docs/TRADUCTION.md) : le circuit de traduction ;
- [docs/OMNIVOICE_COLAB.md](docs/OMNIVOICE_COLAB.md) : la fabrication des voix.

## Commandes

| Commande | Rôle |
|---|---|
| `npm test` | Lance toutes les vérifications. |
| `npm run package` | Crée `dist/alpha-extension.zip`, le fichier à soumettre (environ 1,9 Mo). |
| `npm run audio:export` puis `npm run audio:import -- "<zip>"` | Prépare de nouvelles voix pour Colab, puis les intègre. |

## Limites

- Un message très différent de ceux que connaît ALPHA peut rester en français ; il est alors signalé.
- Les voix éton sont des voix de synthèse provisoires, en attendant des enregistrements faits par des locuteurs.
- En français et en anglais, la lecture dépend des voix installées sur l'appareil.
- Le prototype ne réalise aucune opération financière.

## Équipe

- Ulrich ([@Yibaadev](https://github.com/Yibaadev))
- Nganty Bikele Anicet ([@nganty237](https://github.com/nganty237))
- Georges ([@PrinceGeorges](https://github.com/PrinceGeorges))
