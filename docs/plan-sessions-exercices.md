# Sessions d'exercices — plan de conception

## 1. Les concepts

```
Catégorie (existante : category)        ex. Grammaire
└── Thème (existant : topic)             ex. L'article défini et l'article indéfini
    └── Fiche d'entraînement (nouveau)   titre + source (photo(s) ou consigne texte)
        │                                + leçon « Je retiens / Je sais faire » + compétences
        └── Session (nouveau)            une passation chronométrée par un profil
            └── Exercice (nouveau)       souligner, texte à trous, QCM, classement…
                └── Réponse (nouveau)    chaque réponse de l'élève + correction + explication
```

- **Fiche** = le modèle réutilisable (l'équivalent d'une page du cahier). Elle est créée une fois, à partir d'une photo ou d'une consigne.
- **Session** = une passation. Refaire la fiche = nouvelle session avec de **nouveaux** exercices, générés à partir de l'historique de l'élève.
- On réutilise `category` / `topic` des dictées : les fiches et les dictées partagent la même structure, et les stats peuvent s'agréger par thème.

### La clé de l'adaptatif : les compétences

À la création de la fiche, l'IA découpe le thème en 3 à 6 **compétences** observables. Exemple pour « l'article défini et indéfini » :

| id | compétence |
|---|---|
| `def_indef` | distinguer article défini / indéfini |
| `genre_nombre` | trouver le genre et le nombre de l'article |
| `elision` | utiliser l' devant une voyelle |
| `contraction` | contracter à/de + le/les → au, aux, du, des |
| `pluriel_genre` | retrouver le genre d'un nom au pluriel |

Chaque item d'exercice est rattaché à une compétence. On peut ainsi calculer, sans IA, une **maîtrise par compétence**. C'est ce calcul qui alimente le rapport (« compris / à revoir ») et la génération de la session suivante (« insister sur `contraction` »).

## 2. Les types d'exercices (catalogue figé de widgets)

L'IA ne produit pas d'interface : elle choisit un type dans un catalogue fermé et remplit un JSON validé par zod. Chaque type a son composant React. Ce cadre fixe permet de rester « intelligent » côté contenu sans être fragile côté interface.

| type | couvre dans le cahier | correction |
|---|---|---|
| `mark_words` | souligner / entourer / surligner, avec plusieurs couleurs et une légende (« verbes en rouge, sujets en vert »). Sélection d'un mot ou d'un groupe de mots. | déterministe |
| `fill_blanks` | texte à trous, en saisie libre ou avec banque de mots (au/aux/du/des) | déterministe (normalisation + variantes acceptées) |
| `choice` | QCM à réponse unique ou multiple | déterministe |
| `classify` | classer des mots dans des colonnes (noms / déterminants / adjectifs…) | déterministe |
| `label` | étiqueter chaque élément (MS/MP/FS/FP, NP/GN/GNA/PP) | déterministe |
| `rewrite` | réécrire (changer le nombre, remplacer un pronom par un GN) | comparaison normalisée d'abord, puis LLM si la réponse diffère |
| `short_answer` | réponse courte libre (« classe grammaticale de *vitupérer* ») | idem |
| `mini_dictee` | 1 à 3 phrases dictées en audio (TTS) | réutilise `dictation-diff` |

Exemple de payload `mark_words` :

```json
{
  "type": "mark_words",
  "instruction": "Souligne les verbes en rouge et les sujets en vert.",
  "legend": [{ "key": "verbe", "color": "red" }, { "key": "sujet", "color": "green" }],
  "text": "Tom aime la géographie. Le jeune garçon a présenté un exposé.",
  "targets": [
    { "span": "Tom", "key": "sujet", "skill": "sujet_np", "why": "C'est Tom qui aime : nom propre sujet." },
    { "span": "aime", "key": "verbe", "skill": "verbe", "why": "Il change si on dit « hier » → aimait." },
    { "span": "Le jeune garçon", "key": "sujet", "skill": "sujet_gn", "why": "…" },
    { "span": "a présenté", "key": "verbe", "skill": "verbe_compose", "why": "…" }
  ]
}
```

**Principe de correction** (dans la ligne du dernier commit sur les dictées) : la note et le vrai/faux sont calculés **de façon déterministe**. Les explications (`why`, et un retour pour chaque mauvaise réponse prévisible) sont **pré-générées avec l'exercice**. Le retour immédiat est donc instantané, gratuit et cohérent. Le LLM n'est appelé en direct que pour les réponses ouvertes (`rewrite`, `short_answer`) et pour le bouton « Pourquoi ? / Demande au prof ».

## 3. Le tuteur IA : un plan initial et des ajustements

L'agent n'est ni totalement libre ni totalement figé.

1. **Au démarrage** de la session, l'IA reçoit la leçon, les compétences, le niveau du profil, la maîtrise par compétence et les phrases déjà utilisées dans les sessions précédentes (pour ne jamais les répéter). Elle produit un **plan** de 4 à 6 exercices (~15 min), ordonnés du plus facile au plus difficile et pondérés vers les compétences faibles. Elle varie les types d'exercices en s'inspirant de ceux présents sur la photo.
2. **Pendant la session**, après chaque exercice, une règle simple décide de la suite :
   - si le score sur une compétence est sous 60 %, le tuteur insère un **exercice de remédiation** sur cette compétence (plus court, plus guidé, précédé d'un rappel de la règle avec ▶) ;
   - au plus 2 remédiations par compétence, puis on passe à la suite, pour éviter qu'une session ne dure indéfiniment.
3. **Messages du tuteur** entre deux exercices : une phrase courte et personnalisée (« Bravo pour les contractions ! Attention : *des* peut être un article indéfini OU la contraction de *de les*. »), avec bouton ▶.
4. **Bouton « Pourquoi ? »** sur chaque correction : c'est un mini-chat contextualisé (l'exercice, la réponse de l'élève et la règle). L'élève peut poser une question à l'oral ou à l'écrit.
5. Pour masquer la latence, on **pré-génère l'exercice suivant** pendant que l'élève travaille sur l'exercice en cours. Seule une remédiation impose une attente, signalée par « Le prof prépare un exercice… ».

Implémentation : l'endpoint `POST /api/training/sessions/:id/next` renvoie la prochaine étape sous forme d'une union typée `lesson | exercise | tutor_message | finish`. Toute la logique de décision reste côté serveur.

## 4. Les parcours et écrans

**Nouvelle fiche** (`/exercices/sessions/nouvelle`)
1. Photo(s), prise directement avec l'appareil sur mobile, **ou** thème + consigne en texte.
2. L'IA analyse la source et **propose** une catégorie, un thème et un titre (« Grammaire › L'article défini et indéfini »). L'utilisateur confirme, choisit un thème existant ou en crée un nouveau directement dans le formulaire.
3. L'IA extrait la leçon (« Je retiens », « Je sais faire », exemples) et les compétences. L'utilisateur relit et peut corriger.
4. Enregistrement, puis bouton « Commencer une session ».

**Page fiche** (`/exercices/sessions/fiche/[id]`) : la leçon avec ▶, la maîtrise par compétence (jauges), l'historique des sessions (date, note, durée, tendance) et le bouton « Nouvelle session ».

**Lecteur de session** (`/exercices/sessions/[sessionId]`)
- En-tête : chronomètre (avec pause, seul le temps actif est compté), progression et note en cours.
- Leçon en rappel (repliable, ▶) au début de la session.
- Un exercice à la fois. Chaque réponse validée affiche immédiatement vert ou rouge avec l'explication (▶ et « Pourquoi ? »).
- Reprise possible : une session interrompue reprend là où elle s'était arrêtée.

**Rapport de fin** (affiché à la fin, puis consultable plus tard)
- Note /20, durée et nombre d'items.
- « Ce que tu as compris » et « À revoir », par compétence.
- Le message du tuteur et un conseil pour la prochaine fois.
- La revue de chaque exercice avec les réponses de l'élève surlignées (vert si juste, rouge si faux, avec la bonne réponse).

**Historique global** (`/exercices/sessions`) : toutes les fiches, regroupées par catégorie et thème, avec la dernière note. Un filtre par catégorie réutilise `CategoryFilters`.

**Gestion des catégories** : un écran (ou une boîte de dialogue) pour créer et renommer les catégories et les thèmes. La suppression est bloquée si le thème est utilisé par une dictée ou une fiche. Aujourd'hui il n'existe aucune interface pour `category` / `topic`.

## 5. La voix (TTS)

**Choix retenu : ElevenLabs, modèle `eleven_v4_turbo`** (0,04 $/1 000 caractères, ~100 ms de latence, prend en charge le français). `eleven_flash_v2_5` coûte le même prix ; c'est la solution de secours.

**Génération à la demande uniquement**
- Un bouton ▶ apparaît sur la leçon, les consignes, les explications et les messages du tuteur, ainsi que pour les mini-dictées. **Rien n'est généré à l'avance** : l'audio est synthétisé seulement au premier clic sur ▶.
- Endpoint `POST /api/tts` avec `{ text }`. La voix est celle du profil courant, lue côté serveur. L'endpoint calcule `hash(texte + voice_id + modèle)`, cherche `audio/tts/<hash>.mp3` dans Supabase et le renvoie s'il existe. Sinon, il appelle ElevenLabs (`language_code: "fr"`, `mp3_44100_128`), enregistre le fichier et renvoie l'URL. Un texte n'est donc payé qu'une fois par voix, et un second clic est gratuit.
- Garde-fous : un texte de 1 500 caractères au maximum par appel, la session doit être authentifiée, et chaque génération est journalisée (nombre de caractères, profil) pour suivre la consommation.
- Il faut indiquer que la voix est générée par IA (une petite mention près du bouton ▶).

**Voix par profil**
- Nouveau champ `profiles.tts_voice_id String?`. `null` signifie la voix par défaut (variable d'environnement `ELEVENLABS_DEFAULT_VOICE_ID`).
- Dans l'édition du profil, un bloc « Voix du prof » est ajouté à côté des réglages de conjugaison. Il liste les voix françaises avec un bouton d'écoute, qui utilise le `preview_url` fourni par ElevenLabs : **l'écoute de démonstration ne consomme aucun crédit**.
- La liste est chargée via `GET /v2/voices?language=fr` (les voix enregistrées dans le compte ElevenLabs), puis mise en cache côté serveur. Pour proposer une nouvelle voix aux enfants, il suffit de l'ajouter dans « My Voices » sur ElevenLabs, sans toucher au code.
- Changer de voix ne régénère rien : les prochains ▶ utiliseront la nouvelle voix, à la demande.

**La voix par défaut**
- Les voix « Default » historiques d'ElevenLabs **expirent le 31 décembre 2026**. On ne peut donc pas s'appuyer sur l'une d'elles : la voix par défaut doit venir de la **Voice Library**.
- La Voice Library n'est accessible via l'API qu'avec une offre payante ; il faut donc au minimum l'offre **Starter à 6 $/mois**.
- Critères de choix : langue française, accent de France, catégorie « professional » ou « high quality », usage « narration » ou « éducatif ». On cherche une voix posée et chaleureuse, au débit modéré, adaptée à un enfant de primaire.
- Mise en place : on présélectionne 3 à 5 voix françaises dans la Voice Library (féminines et masculines), on les ajoute à « My Voices », et l'une d'elles devient `ELEVENLABS_DEFAULT_VOICE_ID`. Je peux les présélectionner via l'API avec la clé ElevenLabs (`GET /v1/shared-voices?language=fr&accent=…`).

### Comparaison OpenAI / ElevenLabs (prix d'octobre 2026)

| option | API | prix | ≈ par minute d'audio | état |
|---|---|---|---|---|
| OpenAI `gpt-4o-mini-tts` | `/v1/audio/speech` (HTTP simple) | 12 $/M tokens audio | ≈ 0,015 $ | **s'arrête le 6 janvier 2027** |
| OpenAI `gpt-realtime-2.1-mini` | Realtime (WebSocket) | 20 $/M tokens audio en sortie | ≈ 0,025 $ | remplaçant officiel ; modèle conversationnel |
| OpenAI `gpt-audio-1.5` | Chat Completions (HTTP) | 64 $/M tokens audio en sortie | ≈ 0,08 $ | modèle conversationnel (`gpt-audio-mini` s'arrête le 20 janvier 2027) |
| ElevenLabs `v4 Turbo` / `Flash` | HTTP simple, renvoie un mp3 | 0,04 $/1 000 caractères | ≈ 0,04 $ | TTS pur, ~75–100 ms de latence |
| ElevenLabs `v4` / `v2 Multilingual` | HTTP simple | 0,08 $/1 000 caractères | ≈ 0,08 $ | TTS pur, le plus expressif |

Les coûts par minute d'OpenAI sont des estimations : OpenAI facture en tokens audio, et j'ai pris environ 1 250 tokens par minute (le ratio de `gpt-4o-mini-tts`). ElevenLabs facture à la minute, environ 1 000 caractères par minute.

Les abonnements ElevenLabs incluent un quota de caractères :

| offre | prix | quota `v4` | quota `v4 Turbo` |
|---|---|---|---|
| Free | 0 $ | 10 000 car. (~10 min) | 20 000 car. (~20 min) |
| Starter | 6 $/mois | 75 000 (~75 min) | 150 000 (~150 min) |
| Creator | 22 $/mois | 275 000 (~275 min) | 550 000 (~550 min) |

Le plan gratuit n'inclut pas de licence commerciale ; les plans payants à partir de Starter l'incluent.

**Estimation pour My Best French** : 2 enfants × 1 session par jour, soit environ 60 sessions par mois. Une session lit environ 3 500 caractères si l'élève écoute tout (leçon, consignes, explications, messages du tuteur).

| scénario | volume / mois | OpenAI realtime-mini | ElevenLabs v4 Turbo | ElevenLabs v4 |
|---|---|---|---|---|
| tout est écouté | ~210 min | ≈ 5 $ | ≈ 8 $ (Creator) | ≈ 17 $ (Creator 22 $) |
| réaliste (~40 % écouté, leçons en cache) | ~80 min | ≈ 2 $ | ≈ 3 $ (dans Starter 6 $) | ≈ 6,5 $ (Starter 6 $, un peu juste) |

**Pourquoi ElevenLabs malgré un coût un peu plus élevé :**
1. **Le texte est lu tel quel.** Les modèles OpenAI qui restent disponibles après janvier 2027 sont conversationnels : il faut leur demander de répéter un texte, et ils peuvent reformuler, ajouter un mot ou changer la ponctuation orale. Ce n'est pas acceptable pour une dictée ou pour lire une règle de grammaire.
2. **La qualité en français.** Les voix d'ElevenLabs sont nettement plus naturelles en français ; celles d'OpenAI sont optimisées pour l'anglais.
3. **La simplicité.** Un appel HTTP renvoie un mp3, ce qui s'intègre facilement au cache Supabase. `gpt-realtime-2.1-mini` impose une session WebSocket côté serveur, juste pour lire une phrase.
4. **L'écart de prix est faible** à cette échelle : quelques dollars par mois, et le cache le réduit encore.

Pour la reconnaissance vocale (phase 3), les deux sont équivalents : OpenAI `gpt-transcribe` coûte environ 0,0045 $/min et ElevenLabs `Scribe v2` environ 0,0037 $/min (0,22 $/h).
- Pour la question posée à l'oral par l'élève (phase 3), on utiliserait la transcription speech-to-text.

## 6. Le modèle de données (Prisma, via `db push`)

```prisma
model training_sheet {            // la fiche
  id              Int      @id @default(autoincrement())
  user_id         String               // propriétaire (compte)
  topic_id        Int
  title           String   @db.VarChar(200)
  source_type     String               // "photo" | "text"
  source_images   String[]             // chemins dans le bucket images
  source_text     String?              // consigne libre
  lesson_json     Json                 // { je_retiens: [...], je_sais_faire: [...], exemples: [...] }
  skills_json     Json                 // [{ id, label, description }]
  exercise_hints  Json?                // types d'exercices repérés sur la photo
  archived        Boolean  @default(false)
  created_at / updated_at
  topic           topic    @relation(...)
  sessions        training_session[]
}

model training_session {
  id               String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  sheet_id         Int
  profile_id       String   @db.Uuid
  user_id          String
  status           String   // "in_progress" | "completed" | "abandoned"
  started_at       DateTime
  completed_at     DateTime?
  active_seconds   Int      @default(0)    // chrono, pauses exclues
  score_20         Decimal? @db.Decimal(4,1)
  items_total      Int      @default(0)
  items_correct    Int      @default(0)
  plan_json        Json                     // plan initial du tuteur
  skills_result    Json?                    // { skillId: { correct, total } }
  report_json      Json?                    // compris / à revoir / message / conseil
  model_name       String?
  exercises        training_exercise[]
  @@index([profile_id, started_at])
  @@index([sheet_id, profile_id])
}

model training_exercise {
  id             Int      @id @default(autoincrement())
  session_id     String   @db.Uuid
  position       Int
  type           String                  // mark_words | fill_blanks | choice | ...
  is_remediation Boolean  @default(false)
  skill_ids      String[]
  payload        Json                    // contenu + corrigé + explications (validé par zod)
  status         String   @default("pending")   // pending | done
  items_total    Int      @default(0)
  items_correct  Int      @default(0)
  completed_at   DateTime?
  answers        training_answer[]
}

model training_answer {
  id            Int      @id @default(autoincrement())
  exercise_id   Int
  item_key      String                   // index du trou, id de la cible, etc.
  answer        Json
  is_correct    Boolean
  feedback      String?                  // explication affichée
  graded_by     String                   // "rule" | "llm"
  time_ms       Int?
  created_at    DateTime @default(now())
}
```

```prisma
// Ajouts pour la voix
// profiles : tts_voice_id String?        // null = ELEVENLABS_DEFAULT_VOICE_ID

model tts_audio {                         // cache + suivi de consommation
  id          Int      @id @default(autoincrement())
  hash        String   @unique            // hash(texte + voice_id + modèle)
  voice_id    String
  model_id    String
  characters  Int
  file_path   String                      // audio/tts/<hash>.mp3
  profile_id  String?  @db.Uuid           // profil qui a déclenché la génération
  created_at  DateTime @default(now())
}
```

Les fiches appartiennent au compte : elles sont partagées entre les enfants, comme les dictées. Les sessions et les notes sont propres à chaque profil.

**Anciennes tables** : `exercises`, `generated_questions` et `exercise_levels` ne sont plus utilisées par le code (seul le client généré les mentionne). Elles ne conviennent pas à ce besoin, qui suppose plusieurs types d'exercices et un regroupement en sessions. Je propose de ne pas y toucher pour l'instant et de les supprimer plus tard.

## 7. Statistiques et histogrammes

- **1 exercice terminé = 1 barre de dictée.** Au moment où un exercice passe à `done`, on insère une ligne dans `exercices_attempts` avec un nouveau champ `training_exercise_id`, sur le modèle de `conjugaison_id`. Les routes `last-7-days` et `stats` le comptent alors automatiquement avec un poids de 1.
- Dans `ExerciseAttemptsChart`, on ajoute une 3ᵉ série « Exercices » d'une autre couleur, à côté des dictées et des conjugaisons.
- Sur la page d'accueil : un widget « Dernières sessions » (note, thème, tendance).

## 8. Les appels IA

| étape | entrée | sortie (zod) |
|---|---|---|
| analyse de la source | photo(s) (vision) ou texte, liste des catégories et thèmes existants, niveau | catégorie/thème proposés, titre, leçon, compétences, types d'exercices repérés |
| plan de session | leçon, compétences, maîtrise, rapports précédents, phrases déjà vues, niveau | plan + exercices 1 et 2 |
| exercice suivant / remédiation | plan, résultats en cours, compétence ciblée | 1 exercice |
| correction ouverte | consigne, réponse attendue, réponse de l'élève | `{ correct, feedback }` |
| « Pourquoi ? » | exercice, réponse, règle, question | texte en streaming |
| rapport final | résultats par compétence (calculés), erreurs | compris / à revoir / message / conseil |

Tous les appels utilisent `zodTextFormat`, comme pour la validation des dictées. On remplace la constante unique `OPENAI_MODEL` (`src/lib/ai-models.ts`) par **deux niveaux** :

| constante | modèle | prix (in/out par MTok) | usage |
|---|---|---|---|
| `AI_MODEL_FAST` | `gpt-6-luna` (actuel) | 0,10 $ / 0,50 $ | explications de dictée, correction des réponses ouvertes, « Pourquoi ? » |
| `AI_MODEL_SMART` | `gpt-6.1-terra` | 1 $ / 5 $ | analyse de la photo (vision), génération du plan et des exercices, rapport |

`gpt-6.1-terra` est présenté comme fort en raisonnement visuel et en écriture claire, ce qui correspond à la lecture d'une page de cahier et à la rédaction d'exercices pour un enfant. `gpt-6.1-sol` (2 $ / 10 $) ou `gpt-6-astra` (10 $ / 50 $) restent possibles si la qualité des exercices ne suffit pas. Les contenus générés sont **nouveaux** : le prompt interdit de recopier les phrases du cahier (pour le droit d'auteur, et parce que l'élève a déjà les réponses du livre).

## 9. Découpage proposé

**Phase 1 — le socle utilisable** ✅ livrée
- Gestion des catégories et des thèmes (création directement dans le formulaire, plus un écran dédié).
- Création de fiche à partir d'une photo ou d'un texte, avec extraction de la leçon et des compétences, et relecture.
- Génération de session en une fois (plan de 4 à 6 exercices), avec 5 widgets : `choice`, `fill_blanks`, `mark_words`, `classify`, `label`.
- Correction déterministe immédiate avec explications pré-générées.
- Chronomètre, enregistrement en base, note /20, rapport de fin, revue surlignée.
- Historique par fiche et global ; intégration dans les histogrammes.
- La session suivante tient compte des rapports et des phrases déjà vues.

**Phase 2 — la voix et les réponses ouvertes** ✅ livrée (sauf `mini_dictee`)
- ✅ TTS ElevenLabs `eleven_v4_turbo`, généré au premier ▶ puis mis en cache (leçon, consignes, explications, intro, bilan, réponses du prof). Les ▶ restent masqués tant que `ELEVENLABS_API_KEY` n'est pas défini.
- ✅ Choix de la voix dans le profil de l'enfant (voix françaises du compte ElevenLabs, extraits gratuits). Voix par défaut : `ELEVENLABS_DEFAULT_VOICE_ID`, sinon la première voix française du compte.
- ✅ `rewrite` et `short_answer` : correspondance exacte d'abord, puis le LLM juge les réponses différentes (variantes valables acceptées, fautes refusées).
- ✅ Bouton « Pourquoi ? » sous chaque correction (chat en streaming, 6 questions max, disponible uniquement après avoir répondu).
- ⏳ `mini_dictee` (1 à 3 phrases dictées) : reportée.

**Phase 3 — le vrai tuteur**
- Pré-génération de l'exercice suivant et remédiation adaptative pendant la session.
- Messages du tuteur entre les exercices.
- Questions posées à l'oral par l'élève (STT).
- Jauges de maîtrise par compétence et suggestions sur l'accueil (« Tu devrais revoir les contractions »).
