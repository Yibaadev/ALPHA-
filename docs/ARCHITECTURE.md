# Architecture d'ALPHA

Ce document s'adresse aux développeurs qui reprennent le projet. Il décrit l'organisation du code et le trajet d'un texte, de la page jusqu'à l'affichage et la voix.

## Principe

ALPHA est une extension Chrome (Manifest V3) **sans serveur et sans modèle d'IA embarqué**. Elle se compose uniquement de *content scripts*, chargés dans chaque page et chaque cadre (`all_frames`). Ces scripts lisent le texte affiché et le remplacent par sa traduction. Ils ne modifient jamais le code du site, et ne collectent ni n'envoient aucune donnée.

Les scripts n'utilisent pas de modules ES. Chaque fichier ajoute son API à un espace de noms global unique, `globalThis.ALPHA` (par exemple `ALPHA.translate` ou `ALPHA.panel`). **L'ordre de chargement est donc important.** C'est celui de la liste `content_scripts.js` du manifeste : les moteurs, puis l'interface, puis `content.js` en dernier.

## Organisation

| Dossier | Rôle | Livré ? |
|---|---|---|
| `extension/` | L'extension elle-même, chargée telle quelle par Chrome | oui |
| `content/` | Sources linguistiques : lexique complet, traductions en cours, lots audio de Colab | non |
| `scripts/` | Outils de l'équipe (build, audio, traduction, lexique) | non |
| `tests/` | Tests automatiques, lancés par `npm test` | non |
| `docs/` | Documentation | non |

### `extension/src/`

| Dossier | Fichiers | Responsabilité |
|---|---|---|
| `content/` | `content.js` | Point d'entrée : charge les données, parcourt le DOM (y compris les Shadow DOM ouverts), écrit les traductions, crée le panneau. |
| | `page-observer.js` | Surveille les changements de la page. Plusieurs changements rapprochés donnent un seul passage, et rien n'est fait quand l'onglet est en arrière-plan. |
| | `translation-controller.js` | Choisit, pour un texte, la traduction à afficher selon la langue demandée. Ce fichier ne manipule pas le DOM. |
| `engine/` | `protect.js` | Repère et protège les valeurs (montants, numéros, noms, dates, références), qui ne sont jamais traduites. |
| | `translate.js` | Moteur principal : correspondance exacte avec le dictionnaire, puis la cascade, puis les messages composés. |
| | `templates.js`, `fuzzy.js`, `segments.js`, `rules.js` | Couches de la cascade : gabarits avec valeurs, quasi-correspondances, assemblage prudent, règles. |
| | `language.js`, `common.js`, `confidence.js` | Détection de la langue, utilitaires partagés, niveaux de fiabilité affichés. |
| | `mt.js` | Traduction hors ligne FR ↔ EN par l'API Translator de Chrome, sur l'appareil. |
| `guide/` | `guide.js`, `guide-controller.js` | Guide « ? » : reconnaît l'écran, construit « Où suis-je / Que faire / Comment ». |
| `voice/` | `read-mode.js` | Lecture au clic. Les clics sur le site sont neutralisés tant que le mode est actif. |
| | `voice.js` | Choisit comment lire : voix locale du système (FR/EN) ou clips éton. En éton, rien n'est jamais lu en français. |
| | `eton-audio.js` | Lit les clips éton préenregistrés et découpe une phrase en morceaux enregistrés. |
| `ui/` | `panel.js`, `panel-guide.js`, `panel-read.js`, `*.css` | Panneau ALPHA, isolé du site dans un Shadow DOM. |

### `extension/data/`

| Fichier | Contenu |
|---|---|
| `dictionary.json` | Textes FR / EN / éton. Seules les entrées `"statut": "valide"` sont affichées en éton. |
| `templates.json` | Gabarits avec valeurs, par exemple `Solde disponible : [M1]`. |
| `guide.json` | Textes du guide et de la bulle de présentation. |
| `critical_terms.json`, `rules.json` | Termes sensibles (négation, statut, alerte) et règles de la cascade. |
| `lexicon-valide.json` | Entrées validées du lexique, générées depuis `content/lexique/lexicon.json`. |
| `audio/eton/` | Clips OGG (`omnivoice/`, `locuteur/`) et `index.json`, généré par `npm run audio:index`. |

## Trajet d'un texte

```
Page du site
   │  (MutationObserver → page-observer.js : passages regroupés)
   ▼
content.js ── texte déjà traité et langue inchangée ? ──► gardé tel quel (pas de recalcul)
   │
   ▼
translation-controller.js
   ├── mode FR / EN ─► dictionnaire exact, sinon traduction Chrome sur l'appareil (mt.js)
   └── mode éton ────► translate.js :
           1. correspondance exacte (point final facultatif)
           2. gabarit validé (valeurs [M1]… remises en place)
           3. phrase critique (négation, échec, alerte) : rien d'autre n'est autorisé
           4. fuzzy → segments → règles
           5. message composé (« Titre : phrase. Phrase. ») si chaque partie est validée
           sinon : le texte reste dans sa langue, avec un avertissement
   ▼
Contrôles d'intégrité : mêmes valeurs protégées, dans le même ordre, sinon refus
   ▼
Texte écrit dans la page (l'original est gardé en mémoire pour revenir en arrière)
```

**Lecture au clic.** On touche un élément, `read-mode.js` trouve le bloc de texte et `voice.js` le lit. En éton, `eton-audio.js` cherche le clip de la phrase entière. S'il n'existe pas, il découpe la phrase en morceaux enregistrés. Les valeurs ne sont pas lues.

## Règles à respecter

1. **Ne jamais modifier une valeur.** Toute traduction est refusée si un montant, un numéro ou une référence change.
2. **En éton, n'afficher et ne lire que des textes validés** par un locuteur (`statut: "valide"`).
3. **Rien ne sort de l'appareil** : pas de requête réseau, et uniquement des voix locales.
4. **Style éton commun** (tutoiement « ù », « mòd àtə́ nɔŋ », « kɔ̂nt », « táŋ », « ŋgə́ »). Il est appliqué automatiquement par `scripts/translation/eton-style.js`.
5. **400 lignes au maximum par fichier.** `npm test` le vérifie.

## Flux de travail de l'équipe

- **Traduire** : Gemini propose un texte hors de l'extension, puis le locuteur valide. Voir [TRADUCTION.md](TRADUCTION.md).
- **Voix** : `npm run audio:export`, puis Colab, puis `npm run audio:import -- "<zip>"`. Voir [OMNIVOICE_COLAB.md](OMNIVOICE_COLAB.md).
- **Livrer** : `npm test`, puis `npm run package`, puis soumettre `dist/alpha-extension.zip`.
