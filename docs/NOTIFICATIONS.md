# Notifications : proposition d'architecture

Statut : **proposition**, rien n'est implémenté.

## Objectif

Prévenir l'utilisateur quand quelque chose demande son attention ou mérite d'être su, même quand l'app est fermée. Chaque notification porte sur un **sujet** : une action à faire (`UserAction`), un compte (ou une connexion bancaire), une transaction ou une catégorie du budget.

**Règle de conduite : ne pas spammer.** Une notification n'est envoyée que si l'utilisateur peut agir ou veut vraiment savoir, et chaque type a un mécanisme qui l'empêche de se répéter (voir [Anti-spam](#anti-spam)). Un tap sur la notification ouvre l'écran correspondant.

## État actuel, et ce qu'il impose

| Constat | Conséquence |
|---|---|
| `GET /user_actions` calcule à la demande ce qu'il y a à faire. Rien n'est stocké. | Une notification est un **événement daté** (« ça vient d'arriver »), distinct de l'action, qui est un **état**. Les deux coexistent, et la notification renvoie vers l'action. |
| `User` n'a que `username` (OAuth) : ni email, ni téléphone, ni langue. | Pas d'email ni de SMS. Canaux : **Web Push** (le front est une PWA installable) et une **boîte de notifications dans l'app**. Il faut stocker la langue de l'utilisateur pour rédiger les textes. |
| Le front est une PWA (`@vite-pwa/nuxt`, `generateSW`). | Il faut un service worker qui gère les événements `push` et `notificationclick`. |
| Messenger est en place (transport `async`, un worker en prod). | L'envoi se fait en asynchrone, sans nouvelle infrastructure. |
| Aucune tâche planifiée. La sync n'est lancée qu'à la connexion (`AccountConnectionProcessor`). | Il faut **`symfony/scheduler`** : une tâche quotidienne pour les notifications liées au temps (accès qui expire, fin de mois), et une **sync périodique** pour les alertes sur les transactions, le solde et le budget. |

## Catalogue des notifications (v1)

| Type (`NotificationType`) | Sujet | Déclencheur | Clé de dédoublonnage | Push par défaut | Lien |
|---|---|---|---|---|---|
| `CONNECTION_EXPIRING` | connexion | Tâche planifiée quotidienne, J-7 puis J-1 | `CONNECTION_EXPIRING_{connection}_7D`, `…_1D` | oui | `/profile/connections` |
| `CONNECTION_EXPIRED` | connexion | Tâche planifiée quotidienne, ou `AccountAlertsRequestHandler` quand la banque refuse la sync | `CONNECTION_EXPIRED_{connection}` | oui | `/profile/connections` |
| `CONNECTION_TO_CONFIGURE` | connexion | Connexion créée et toujours sans consentement après 24 h | `CONNECTION_TO_CONFIGURE_{connection}` | oui | lien de consentement |
| `MONTH_CLOSING` | action | Tâche planifiée quotidienne, 5 jours avant la fin du mois, s'il reste des transactions du mois à catégoriser | `MONTH_CLOSING_{user}_{YYYY-MM}` | oui | `/transactions/to-categorize` |
| `BALANCE_LOW` | compte | `AccountAlertsRequestHandler` (async, après une sync) : le solde d'un compte courant **passe sous** le seuil réglé sur ce compte | `BALANCE_LOW_{account}_{YYYY-MM-DD}` (jour du franchissement) | oui | `/accounts/{id}` |
| `LARGE_TRANSACTION` | transaction | `AccountAlertsRequestHandler` : nouveau débit au-dessus du seuil (montant fixe, 200 € par défaut, modifiable) | `LARGE_TRANSACTION_{transaction}` | oui | `/accounts/{id}?transaction={id}` |
| `INCOME_RECEIVED` | transaction | `AccountAlertsRequestHandler` : nouveau crédit catégorisé `income` (le salaire, par exemple) | `INCOME_RECEIVED_{transaction}` | non | idem |
| `BUDGET_ALMOST_EXCEEDED` | catégorie | `AccountAlertsRequestHandler` : après la sync, le dépensé du mois d'une catégorie budgétée atteint 80 % de sa ligne de budget | `BUDGET_ALMOST_EXCEEDED_{category}_{YYYY-MM}` | oui | `/budget` |
| `BUDGET_EXCEEDED` | catégorie | `AccountAlertsRequestHandler` : après la sync, le dépensé du mois d'une catégorie budgétée dépasse sa ligne de budget | `BUDGET_EXCEEDED_{category}_{YYYY-MM}` | oui | `/budget` |

**Format de la clé de dédoublonnage** : `{TYPE}_{uuid du sujet}[_{période}]`. La période (`7D`, `YYYY-MM`, `YYYY-MM-DD`) dit à quelle fréquence la notification peut revenir pour ce sujet. Sans période, elle n'est envoyée qu'une fois. C'est cette clé, et non un compteur, qui empêche le spam (voir [Anti-spam](#anti-spam)).

**Notifications écartées :**
- un échec de sync : l'utilisateur ne peut rien y faire. Si l'accès a expiré, c'est `CONNECTION_EXPIRED` qui le prévient ;
- les transactions classées par une règle, à vérifier : elles restent dans la carte « À faire », sans notification ;
- une notification à chaque arrivée de transactions : remplacée par le rappel de fin de mois `MONTH_CLOSING`, qui invite à clôturer le budget.

**`MONTH_CLOSING`** reprend le nombre de transactions de `TRANSACTIONS_TO_CATEGORIZE`, limité au mois en cours : « Plus que 5 jours pour clôturer le budget de novembre : 8 transactions à catégoriser ». S'il n'en reste aucune, rien n'est envoyé.

**`BALANCE_LOW`** part au **franchissement** du seuil vers le bas (solde avant la sync ≥ seuil > solde après). Un solde qui reste bas ne renvoie rien. S'il remonte au-dessus du seuil (salaire, virement) puis repasse dessous, c'est un nouveau franchissement, qui envoie une nouvelle notification. La date dans la clé limite à une notification par jour si le solde oscille autour du seuil entre deux syncs du même jour. Elle ne concerne que les comptes courants. Le seuil est réglé **par compte** (`Account.lowBalanceThreshold`, nullable). Il n'y a ni valeur globale ni valeur par défaut : sans seuil réglé, le compte n'envoie jamais `BALANCE_LOW`.

**`BUDGET_ALMOST_EXCEEDED`** (80 %) et **`BUDGET_EXCEEDED`** (100 %) sont envoyées chacune au plus **une fois par catégorie et par mois** (clé de dédoublonnage). Si une même sync fait passer une catégorie de moins de 80 % à plus de 100 %, seule `BUDGET_EXCEEDED` est envoyée, et la clé de `BUDGET_ALMOST_EXCEEDED` est enregistrée aussi pour qu'elle ne parte pas ensuite. Le handler recalcule le dépensé du mois en cours (la même requête que le relevé, `StatementProvider`), seulement pour les catégories touchées par les transactions de la sync, et le compare à la `BudgetLine` de la catégorie. Un dépassement causé par une catégorisation manuelle n'envoie rien sur le moment : l'utilisateur vient de le voir. Il est signalé à la sync suivante s'il dure toujours.

## Modèle de données (API)

### `Notification`

| Champ | Type | Note |
|---|---|---|
| `id` | uuid v7 | |
| `owner` | `User` | `onDelete: CASCADE` |
| `type` | `NotificationType` (enum) | |
| `account` | `?Account` | `onDelete: CASCADE` |
| `accountConnection` | `?AccountConnection` | `onDelete: CASCADE` |
| `transaction` | `?Transaction` | `onDelete: CASCADE` |
| `category` | `?Category` | `onDelete: CASCADE` (`BUDGET_*`) |
| `data` | json | Paramètres du texte : `count`, `amount`, `currency`, `expiresAt`… |
| `dedupKey` | string | `UNIQUE(owner_id, dedup_key)`, ex. `BUDGET_EXCEEDED_0193…_2026-11` |
| `createdAt` | datetime | |
| `readAt` | ?datetime | |
| `pushedAt` | ?datetime | null tant que le push n'est pas parti, ou s'il n'y en a pas |

**Pourquoi des relations explicites plutôt qu'un couple générique `subjectType`/`subjectId` :**
- les clés étrangères suppriment la notification avec son sujet ;
- API Platform les sort en liens HAL (`_links.account`, `_links.transaction`), comme `UserAction` ;
- le voter vérifie l'owner simplement.

Il y a quatre colonnes nullable, avec au plus une renseignée (contrôlé par un validateur).

**Pourquoi le texte n'est pas stocké :** le front le compose à partir de `type` et `data`, avec l'i18n qui existe déjà. Le push aussi : le service worker est du code front (voir [Langue](#langue)).

### `PushSubscription`

| Champ | Type | Note |
|---|---|---|
| `id` | uuid **v5** de `endpoint` | Déterministe : le même navigateur a toujours le même id, ce qui rend l'enregistrement idempotent (`PUT`, voir [API](#api)) |
| `owner` | `User` | |
| `endpoint` | text | `UNIQUE` |
| `p256dh`, `auth` | string | Clés de la `PushSubscription` du navigateur |
| `locale` | string | `fr` / `en`, envoyée par le front à l'abonnement |
| `userAgent` | ?string | Pour afficher « Chrome sur Android » dans le profil |
| `createdAt`, `lastSuccessAt` | datetime | |

Un utilisateur a un abonnement par appareil ou navigateur.

### `NotificationSettings`

`User` n'est pas une ressource de l'API : les préférences sont une ressource à part, **une par utilisateur**, sur le modèle de `Budget` (la collection, filtrée par `CurrentUserExtension`, contient 0 ou 1 élément). Les réglages sont stockés en json : une table par type n'apporte rien tant qu'il n'y a pas de requête dessus.

```json
{
  "push": { "MONTH_CLOSING": true, "INCOME_RECEIVED": false },
  "largeTransactionThreshold": "200.00",
  "hideAmounts": false
}
```

Le seuil de solde bas n'est pas ici : il est propre à chaque compte (`Account.lowBalanceThreshold`).

Une clé absente, ou une ressource pas encore créée, prend la valeur par défaut du catalogue (`NotificationType::defaultPush()`). La notification dans l'app est toujours créée : la préférence ne coupe que le push.

## Flux

```
 Déclencheurs                         Notifier                              Worker async
 ────────────                         ────────                              ────────────
 Scheduler (DailyNotifications) ─┐
                                 ├──▶ Notifier::notify(owner, type,     ┌─▶ SendPushNotification
 AccountAlertsRequestHandler    ─┘       subject, data, dedupKey)        │     ├─ préférences
   (async, après la sync)               ├─ dédoublonne (clé unique)     │     ├─ texte localisé
                                       ├─ persiste Notification ────────┘     ├─ minishlink/web-push → chaque abonnement
                                       └─ dispatch(SendPushNotification)      └─ 404/410 → supprime l'abonnement
```

1. **`App\Notification\Notifier`** est le seul point d'entrée. Il fait un `INSERT … ON CONFLICT (owner_id, dedup_key) DO NOTHING`. Si la notification existe déjà, rien n'est envoyé : relancer un handler ou une tâche planifiée ne crée donc jamais de doublon. Il envoie ensuite `SendPushNotification(notificationId)` après le flush.
2. **`AccountAlertsRequestHandler`** (async) calcule les alertes liées aux transactions et au solde, **hors de la requête HTTP** et hors de la sync elle-même. `AccountAlertsRequest(accountId, syncId)` est envoyé :
   - **après une sync réussie**, par `AccountCategorizationRequestHandler` une fois les règles appliquées, pour que `INCOME_RECEIVED` et `BUDGET_*` voient les catégories posées par les règles. Le handler compare le solde d'avant la sync (à ajouter sur `AccountSync`) à celui d'après, pour `BALANCE_LOW`. Il parcourt les transactions arrivées avec cette sync, pour `LARGE_TRANSACTION` et `INCOME_RECEIVED`, et recalcule le budget des catégories touchées, pour `BUDGET_ALMOST_EXCEEDED` et `BUDGET_EXCEEDED` ;
   - **après une sync refusée par la banque**, directement par `AccountSyncRequestHandler`. Le handler ne vérifie alors que `CONNECTION_EXPIRED`.

   Rien n'est calculé dans `TransactionProcessor` ni pendant la sync elle-même.
3. **`SendPushNotificationHandler`** (async) :
   - **Préférence** : si le type est désactivé en push, on s'arrête là.
   - **Envoi** : avec `minishlink/web-push` (VAPID), à chaque `PushSubscription` de l'utilisateur. L'en-tête `Topic` vaut le type et le sujet, pour qu'un push non encore reçu soit remplacé par le suivant plutôt qu'empilé. Le `TTL` est de 24 h.
   - **Abonnement mort** : une réponse 404 ou 410 supprime l'abonnement. Une erreur 5xx relance l'envoi (`retry_strategy`, à configurer sur ce message seulement).
   - Une fois l'envoi fait, on renseigne `pushedAt`.
4. **`symfony/scheduler`**, à l'heure du serveur (UTC). Un `#[AsSchedule]` (`App\Scheduler\MainSchedule`) déclare les messages récurrents. Le worker existant les consomme en ajoutant le transport du scheduler : `messenger:consume async scheduler_default`. Aucune crontab, aucun nouveau conteneur. Chaque message planifié ne fait qu'en envoyer d'autres sur `async` (un par compte ou par utilisateur), pour qu'un compte en erreur ne bloque pas les autres.
   - **`DailyNotificationsMessage`, tous les jours à 8 h UTC** :
     - les accès qui expirent ou ont expiré, et les connexions jamais configurées ;
     - `MONTH_CLOSING`, qui ne fait rien sauf 5 jours avant la fin du mois (calculé en UTC) ;
     - la purge des notifications lues de plus de 90 jours.
   - **`SyncAllAccountsMessage`, 1 à 3 fois par jour** : sync de chaque compte bancaire actif (`AccountSyncRequest`), dans la limite des quotas GoCardless. C'est un **prérequis** de `BALANCE_LOW`, `LARGE_TRANSACTION`, `INCOME_RECEIVED` et `BUDGET_*`.

   ```php
   #[AsSchedule]
   final class MainSchedule implements ScheduleProviderInterface
   {
       public function __construct(private CacheInterface $cache, private LockFactory $lockFactory) {}

       public function getSchedule(): Schedule
       {
           return new Schedule()
               ->add(RecurringMessage::cron('0 8 * * *', new DailyNotificationsMessage()))
               ->add(RecurringMessage::cron('0 6,12,18 * * *', new SyncAllAccountsMessage()))
               // Survives a worker restart without running a missed tick twice
               ->stateful($this->cache)
               // Only one worker runs each tick if the worker is ever scaled
               ->lock($this->lockFactory->createLock('main-schedule'));
       }
   }
   ```

   `stateful()` garde en cache le dernier passage : si le worker redémarre à 8 h 01, la tâche de 8 h est rattrapée une seule fois. `lock()` empêche deux workers de lancer la même tâche. `RecurringMessage::cron()` demande `dragonmantank/cron-expression`.

### Anti-spam

Avec 1 à 3 syncs par jour, un utilisateur ne doit pas recevoir un push à chacune. Plutôt qu'un compteur arbitraire (« 3 pushes par jour »), qui couperait des notifications utiles au hasard, c'est la **clé de dédoublonnage** qui porte la logique : sa période dit, pour chaque type, combien de fois il peut revenir sur un même sujet.

| Garde-fou | Effet |
|---|---|
| **Clé de dédoublonnage** | `CONNECTION_EXPIRING_{connection}_7D` puis `_1D` : deux rappels au plus par accès. `CONNECTION_EXPIRED_{connection}` : une seule fois. `MONTH_CLOSING_{user}_{YYYY-MM}` : une fois par mois. `BUDGET_ALMOST_EXCEEDED_…` et `BUDGET_EXCEEDED_{category}_{YYYY-MM}` : une fois chacune par catégorie et par mois. `BALANCE_LOW_{account}_{YYYY-MM-DD}` : une fois par jour au plus. |
| **Franchissement de seuil** | `BALANCE_LOW` ne part qu'au passage sous le seuil, pas tant que le solde reste bas. Elle repart après une remontée au-dessus du seuil suivie d'une nouvelle baisse. |
| **Regroupement par sync** | Les notifications par transaction (`LARGE_TRANSACTION`, `INCOME_RECEIVED`) sont limitées à 3 par sync et par type. Au-delà, une seule notification les regroupe (`data.count`), par exemple « 5 grosses dépenses sur le compte joint ». La notification de regroupement a sa propre clé, sur la sync : `LARGE_TRANSACTION_{sync}`. |
| **`Topic` Web Push** | Un push pas encore reçu par l'appareil (téléphone hors ligne) est remplacé par le suivant du même sujet plutôt qu'empilé. |
| **Pas de push par défaut** pour `INCOME_RECEIVED` | L'utilisateur l'active s'il le souhaite. |

### Langue

**Le texte est rédigé par le front, l'API n'envoie que des données.** Le service worker est du code front : il embarque la partie `notifications` des fichiers de langue (`app/i18n/locales/{fr,en}.json`) et la même fonction que la boîte de notifications, `app/utils/notificationText.ts` (clés `notifications.types.<TYPE>.*`). Le texte est donc écrit à un seul endroit. L'API n'a ni `symfony/translation` ni fichiers de traduction, et les dates sont mises en forme par `Intl` dans le navigateur, dans la `locale` de l'abonnement.

**Ce que ça impose :**
- **Tout ce que le texte affiche doit être dans `data`**, puisque le service worker n'a pas de token pour appeler l'API. Par exemple `bankName` pour les notifications `CONNECTION_*`, écrit par l'API à la création. La boîte de notifications s'en sert aussi.
- **Texte de repli** : un téléphone peut recevoir un nouveau type avant d'avoir mis à jour son service worker. Un type inconnu affiche « Nouvelle notification » et ouvre `/notifications`.
- **Safari et le Web Push déclaratif** (iOS 18.4+), qui affiche un push sans exécuter le service worker, demanderait un titre déjà rédigé. Ce n'est pas utilisé ici.

### Contenu du push

```json
{ "type": "MONTH_CLOSING", "data": { "month": "2026-11", "count": 8 }, "locale": "fr", "hideAmounts": false, "url": "/transactions/to-categorize?accounts=checking", "tag": "MONTH_CLOSING_0193…_2026-11", "notification": "/notifications/0193…" }
```

Le service worker en tire « Clôture du budget de novembre · Encore 8 transactions à catégoriser avant la fin du mois. ».

### Contrat de `data` par type

Le texte est composé par `app/utils/notificationText.ts`, qui ne lit **que** `data`. Tout ce qu'il affiche doit donc y être. Les montants sont des décimaux signés en chaîne, comme dans le reste de l'API, et `currency` est le code ISO.

| Type | Sujet (lien HAL) | `data` |
|---|---|---|
| `CONNECTION_EXPIRING`, `CONNECTION_EXPIRED`, `CONNECTION_TO_CONFIGURE` | `accountConnection` | `bankName`, `expiresAt` (sauf `TO_CONFIGURE`) |
| `MONTH_CLOSING` | aucun | `month` (« YYYY-MM »), `count` |
| `BALANCE_LOW` | `account` | `accountId`, `accountName`, `balance`, `threshold`, `currency` |
| `LARGE_TRANSACTION`, `INCOME_RECEIVED` (une transaction) | `transaction` | `accountId`, `accountName`, `amount`, `currency`, `description` |
| `LARGE_TRANSACTION`, `INCOME_RECEIVED` (regroupées) | `account` | `accountId`, `accountName`, `count` |
| `BUDGET_ALMOST_EXCEEDED`, `BUDGET_EXCEEDED` | `category` | `categoryCode` (catégorie système, traduite par le front) ou `categoryName` (catégorie perso), `spent`, `budget`, `currency`, `month` |

`accountId` sert au lien de la boîte de notifications (`/accounts/{id}`). Pour le push, le lien est le champ `url` de la notification. `url` est l'écran ouvert au clic, `notification` l'IRI marquée comme lue à l'ouverture (`?notification={id}`).

Le contenu est chiffré de bout en bout par Web Push, mais il s'affiche sur l'écran verrouillé. Avec `hideAmounts: true`, le texte ne contient aucun montant.

## API

Des ressources et leurs verbes HTTP, sans endpoint d'action. Toutes sont limitées à l'owner (`CurrentUserExtension` et voters), comme le reste de l'API.

### `Notification`

| Requête | Rôle |
|---|---|
| `GET /notifications?page=` | Boîte de notifications, la plus récente en premier |
| `GET /notifications?read=false` | Non lues. Filtre `read` sur le modèle de `uncategorized` et `autoCategorized` |
| `GET /notifications?read=false&itemsPerPage=1` | Pastille de la cloche : le front lit `totalItems`, sans endpoint de compteur dédié |
| `GET /notifications/{id}` | Une notification |
| `PATCH /notifications/{id}` `{ "read": true }` | Marque comme lue. Le serveur renseigne `readAt`. `read: false` la remet en non lue |
| `DELETE /notifications/{id}` | Supprime une notification de la boîte |

Pas de `POST` : seul le serveur crée des notifications.

**« Tout marquer comme lu »** n'a pas d'endpoint : le front envoie un `PATCH` par notification non lue. Grâce à l'anti-spam, il y en a rarement plus d'une poignée. Si ça devient un problème, la piste REST serait un repère de lecture `readUntil` sur `NotificationSettings` (une notification est lue si `readAt` est renseigné ou si `createdAt ≤ readUntil`). Ce serait un simple `PATCH` sur une ressource, plutôt qu'un `POST /notifications/read_all`.

### `PushSubscription`

| Requête | Rôle |
|---|---|
| `GET /push_subscriptions` | Appareils abonnés (profil) |
| `PUT /push_subscriptions/{id}` `{ endpoint, keys: { p256dh, auth }, locale }` | Crée ou met à jour l'abonnement de cet appareil |
| `DELETE /push_subscriptions/{id}` | Désabonne cet appareil |

**Pourquoi `PUT` :** le front calcule l'id lui-même (uuid v5 de `endpoint`, espace de noms URL). S'abonner devient alors idempotent : réabonner le même navigateur, ou renvoyer l'abonnement à chaque ouverture de l'app pour rafraîchir `locale`, remplace la ressource au lieu d'en créer une autre. Le serveur refuse avec une 422 un id qui ne correspond pas à `endpoint`, et utilise l'option `allowCreate: true` d'API Platform sur le `Put`.

### `NotificationSettings`

| Requête | Rôle |
|---|---|
| `GET /notification_settings` | Les préférences de l'utilisateur : 0 ou 1 élément |
| `POST /notification_settings` | Création au premier réglage modifié (422 si elles existent déjà) |
| `PATCH /notification_settings/{id}` | Modification |

### Seuil de solde bas

C'est un champ du compte : `PATCH /accounts/{id}` `{ "lowBalanceThreshold": "150.00" }` (`null` pour couper), sans nouvel endpoint.

La clé publique VAPID n'est pas secrète. Elle va dans la `runtimeConfig.public` du front (`NUXT_PUBLIC_VAPID_PUBLIC_KEY`), ce qui évite un endpoint dédié.

## Front

### Service worker

`generateSW` ne permet pas d'ajouter du code. Il faut passer en **`strategies: 'injectManifest'`** avec un `app/sw.ts` qui reprend le précache actuel (`precacheAndRoute(self.__WB_MANIFEST)` et le fallback de navigation sauf `/api/`), et ajoute deux gestionnaires :
- **`push`** : `showNotification(title, { body, tag, icon, badge, data: { url } })`.
- **`notificationclick`** : met au premier plan un onglet de l'app déjà ouvert et le fait naviguer vers `url`, sinon ouvre l'URL avec `openWindow(url)`. L'URL ouverte porte `?notification={id}` pour que le front marque la notification comme lue.

### Demande de permission

On ne la demande **jamais au chargement** : un refus est définitif, et on ne peut plus la redemander ensuite. On la propose à un moment où elle a du sens :
- **après la première connexion bancaire réussie** : « Être prévenu avant que l'accès à ta banque expire, et quand ton solde devient bas ? » ;
- **dans le profil**, section « Notifications », avec un interrupteur par appareil et un interrupteur par type de notification, le seuil des grosses dépenses et l'option pour masquer les montants ;
- **sur la page d'un compte courant** : le champ « Me prévenir sous … € », vide par défaut.

Sur iOS, le Web Push ne fonctionne que si la PWA est installée sur l'écran d'accueil (iOS 16.4 et plus). Si l'app tourne dans Safari, le profil affiche « Installe l'app pour recevoir les notifications ».

### Boîte de notifications

- Une cloche dans l'en-tête de l'accueil, avec une pastille (`totalItems` de `GET /notifications?read=false&itemsPerPage=1`, rafraîchi au retour sur l'app, `refetchOnWindowFocus`).
- Une page `/notifications` avec une liste groupée par jour, comme les transactions. Le texte vient de l'i18n front (`type` + `data`). Un tap marque la notification lue et ouvre son lien.
- Le carrousel « À faire » reste la vue de **l'état**. Les notifications sont **l'historique**.

## Découpage proposé

1. **Socle et tâche quotidienne** : entités `Notification` et `PushSubscription`, `Notifier`, API de la boîte de notifications, page et cloche côté front, `symfony/scheduler` avec `DailyNotificationsMessage` (et `scheduler_default` ajouté au worker). Premiers types : `CONNECTION_*` et `MONTH_CLOSING`, plus la purge.
2. **Web Push** : clés VAPID, `minishlink/web-push`, service worker en `injectManifest`, demande de permission, préférences.
3. **Sync périodique et alertes** : `SyncAllAccountsMessage`, `AccountAlertsRequest`, `BALANCE_LOW` (seuil par compte), `LARGE_TRANSACTION`, `INCOME_RECEIVED`, `BUDGET_ALMOST_EXCEEDED`, `BUDGET_EXCEEDED`, regroupement.

Chaque étape apporte quelque chose d'utilisable seule.

## Décisions

- **Sync périodique** : 1 à 3 fois par jour. Il ne faut pas que chaque sync produise un push : voir [Anti-spam](#anti-spam).
- **`BALANCE_LOW`** : seuil par compte uniquement, sans valeur globale ni valeur par défaut. Au franchissement du seuil, une fois par jour au plus.
- **`LARGE_TRANSACTION`** : seuil fixe (200 € par défaut, modifiable dans les préférences).
- **Budget** : `BUDGET_ALMOST_EXCEEDED` à 80 % et `BUDGET_EXCEEDED` à 100 %, chacune une fois par catégorie et par mois.
- **Anti-spam** : porté par la clé de dédoublonnage `{TYPE}_{uuid}[_{période}]`, sans limite par jour.
- **Planification** : `symfony/scheduler`, consommé par le worker existant, à l'heure du serveur (8 h UTC). Pas de fuseau par utilisateur.

## Questions ouvertes

- **Seuil de `LARGE_TRANSACTION`** : 200 € convient-il comme valeur par défaut ?
