# dailyBudget — Handoff UI mobile (pour Claude Code)

> Source de la maquette : https://claude.ai/artifact/FYKzAgJM1QGFgUQ6zHZkUz
> API de référence : `DESIGN.md` + OpenAPI (`/` Swagger) du repo dailyBudget.
> Style : **Tailwind CSS** (palette par défaut, police Inter). Mobile first, maquettes en 390×844.

---

## 1. Objectif

Deux écrans :

1. **Accueil `/`** : solde total, puis la liste des connexions bancaires (`AccountConnection`). Chaque connexion est un accordéon qui affiche ses comptes (`Account`) avec leur nom et leur solde.
2. **Compte `/accounts/:id`** : en-tête du compte (nom, banque, solde, état de la synchro), puis la liste des transactions en **scroll infini, groupées par jour**. Chaque ligne affiche l'icône de catégorie, le libellé et le montant.

Le front n'existe pas encore. **La stack est à confirmer avec l'utilisateur avant de commencer** (proposition par défaut : React + Vite + TypeScript + Tailwind v4 + TanStack Query).

---

## 2. Design tokens (Tailwind)

| Rôle | Classe Tailwind | Hex |
|---|---|---|
| Fond d'app | `bg-slate-50` | #f8fafc |
| Surface (cartes) | `bg-white border border-slate-200` | #ffffff / #e2e8f0 |
| Séparateur interne | `border-slate-100` | #f1f5f9 |
| Texte principal | `text-slate-900` | #0f172a |
| Texte secondaire | `text-slate-500` | #64748b |
| Titre de jour | `text-slate-600` | #475569 |
| Primaire | `bg-indigo-600` / `text-indigo-700` | #4f46e5 / #4338ca |
| Texte sur primaire (secondaire) | `text-indigo-100` | #e0e7ff |
| Montant positif | `text-emerald-700` | #047857 |
| Montant négatif | `text-slate-900` (pas de rouge) | |
| Danger | `bg-rose-50 text-rose-800`, bouton `bg-rose-600` | |

- Police : `font-sans` = Inter (400/500/600/700) ; tous les montants en `tabular-nums`.
- Rayons : cartes `rounded-2xl`, carte de solde total `rounded-3xl`, logo de banque `rounded-xl`, icônes de catégorie et badges `rounded-full`.
- Cibles tactiles ≥ 44 px (`size-11` pour les boutons icône, `min-h-16` pour les lignes).
- Icônes : jeu **Lucide** (`lucide-react` ou équivalent), trait 2 px, 20 px.

### Badges d'état de connexion (`externalStatus`)

| Condition | Libellé | Classes |
|---|---|---|
| `LN` | Connecté | `bg-emerald-100 text-emerald-800` |
| `needUserAction()` (CR, GC, UA, RJ, SA, GA) | Action requise | `bg-amber-100 text-amber-800` |
| `EX` / `SU` | Expiré | `bg-rose-100 text-rose-800` |

### Catégories de transaction

| Clé | Libellé | Icône Lucide | Fond / icône |
|---|---|---|---|
| `groceries` | Courses | `ShoppingCart` | `bg-orange-100 text-orange-700` |
| `restaurants` | Restaurants | `Utensils` | `bg-amber-100 text-amber-700` |
| `transport` | Transport | `TrainFront` | `bg-sky-100 text-sky-700` |
| `income` | Revenus | `ArrowDownToLine` | `bg-emerald-100 text-emerald-700` |
| `housing` | Logement | `House` | `bg-violet-100 text-violet-700` |
| `subscriptions` | Abonnements | `Repeat` | `bg-pink-100 text-pink-700` |
| `health` | Santé | `Heart` | `bg-rose-100 text-rose-700` |
| `shopping` | Shopping | `ShoppingBag` | `bg-fuchsia-100 text-fuchsia-700` |
| `transfer` | Virement | `ArrowLeftRight` | `bg-slate-100 text-slate-600` |
| `other` (défaut) | Autre | `CircleHelp` | `bg-slate-100 text-slate-600` |

---

## 3. Écran Accueil

```
┌──────────────────────────────┐
│ Mes comptes              (⟳) │  h1 text-2xl font-bold ; bouton sync global
│ ┌──────────────────────────┐ │
│ │ Solde total              │ │  bg-indigo-600 text-white rounded-3xl p-5
│ │ 13 482,35 €              │ │  text-[34px] font-bold
│ │ 5 comptes · 3 banques    │ │
│ └──────────────────────────┘ │
│ BANQUES CONNECTÉES           │  text-xs font-semibold uppercase tracking-wider text-slate-500
│ ┌──────────────────────────┐ │
│ │[BB] Boursorama (Connecté)⌃│ │  <button aria-expanded> ; logo 40px rounded-xl
│ │     2 comptes · 11 261,56 €│ │
│ │──────────────────────────│ │
│ │     Compte courant  2 341,56 € › │  <a> vers /accounts/:id, pl-[68px]
│ │     FR76 •••• 4821       │ │
│ │     Livret A        8 920,00 € › │
│ └──────────────────────────┘ │
│ [R] Revolut …           ⌄    │
│ [CA] Crédit Agricole (Expiré)│  ouvert : bandeau rose « Reconnecter »
│ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐ │
│   +  Ajouter une banque      │  border-dashed border-indigo-200 bg-indigo-50
│ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘ │
└──────────────────────────────┘
```

Snippet de référence (carte de connexion) :

```html
<article class="overflow-hidden rounded-2xl border border-slate-200 bg-white">
  <button type="button" aria-expanded="true"
          class="flex min-h-[72px] w-full items-center gap-3 px-4 py-3.5 text-left">
    <span aria-hidden="true" class="flex size-10 flex-none items-center justify-center rounded-xl bg-blue-100 text-[13px] font-bold text-blue-700">BB</span>
    <span class="flex min-w-0 flex-1 flex-col gap-0.5">
      <span class="flex items-center gap-2">
        <span class="text-[15px] font-semibold">Boursorama</span>
        <span class="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">Connecté</span>
      </span>
      <span class="text-[13px] text-slate-500">2 comptes · 11 261,56 €</span>
    </span>
    <ChevronDown class="size-5 flex-none text-slate-500 transition-transform rotate-180" />
  </button>
  <div class="flex flex-col border-t border-slate-100">
    <a href="/accounts/{id}" class="flex min-h-16 items-center gap-3 py-3 pl-[68px] pr-4">
      <span class="flex min-w-0 flex-1 flex-col gap-0.5">
        <span class="truncate text-[15px] font-medium">Compte courant</span>
        <span class="flex items-center gap-1.5 text-xs text-slate-500">
          FR76 •••• 4821 <span class="font-medium text-indigo-700">· Synchro…</span>
        </span>
      </span>
      <span class="text-[15px] font-semibold tabular-nums">2 341,56 €</span>
      <ChevronRight class="size-4 text-slate-400" />
    </a>
  </div>
</article>
```

Comportements :

- Accordéon : la première connexion est ouverte par défaut, les autres sont fermées. Plusieurs connexions peuvent être ouvertes en même temps. Mémoriser l'état ouvert dans `localStorage` (dans un try/catch).
- `Synchro…` s'affiche tant que `synchronizedStatus` vaut `PENDING` ou `IN_PROGRESS`. Pendant ce temps, rafraîchir le compte toutes les 3 s, et arrêter dès qu'il passe à `SUCCESS` ou `FAILED`.
- Compte d'une connexion expirée : solde en `text-slate-500` et bandeau `« L'accès bancaire a expiré. Soldes figés au {date}. »`, avec un bouton **Reconnecter** qui fait `POST /account_connections` sur le même `bankId`.
- État `Action requise` : bouton **Finaliser** qui ouvre `_links.configure.href`.
- Bouton ⟳ global : `PATCH /account_connections/{id}/sync` (corps `{}`, `Content-Type: application/merge-patch+json`) sur chaque connexion `LN`.
- **Ajouter une banque** : hors périmètre pour l'instant (flux `GET /banks?country=FR` → `POST /account_connections`). Mettre un lien vers une page provisoire.
- Le solde total est la somme des soldes de tous les comptes, dans une seule devise (EUR). Si les comptes ont plusieurs devises, afficher un total par devise.

---

## 4. Écran Compte / Transactions

```
┌──────────────────────────────┐
│ ‹  Compte courant            │  header fixe bg-white border-b
│    Boursorama · FR76 •••• 4821│
│ Solde                        │
│ 2 341,56 €   ● Synchronisé il y a 2 h │
├──────────────────────────────┤  ↓ zone scrollable
│ Aujourd'hui         −66,88 € │  h2 sticky top-0 bg-slate-50 text-[13px] font-semibold
│ ┌──────────────────────────┐ │
│ │ (🛒) Carrefour City −23,48 €│ │  li min-h-16 ; icône size-10 rounded-full
│ │      Courses              │ │
│ │ (🚆) SNCF Connect   −37,00 €│ │  divide-y divide-slate-100
│ └──────────────────────────┘ │
│ Hier             +2 441,61 € │
│ …                            │
│ [skeleton ×3, animate-pulse] │  pendant le chargement de la page suivante
│ Début de l'historique synchronisé │  quand il n'y a plus de page
└──────────────────────────────┘
```

Snippet de référence (ligne de transaction) :

```html
<li class="flex min-h-16 items-center gap-3 px-3.5 py-2.5">
  <span aria-hidden="true" class="flex size-10 flex-none items-center justify-center rounded-full bg-orange-100 text-orange-700">
    <ShoppingCart class="size-5" />
  </span>
  <span class="flex min-w-0 flex-1 flex-col gap-0.5">
    <span class="truncate text-[15px] font-medium">Carrefour City</span>
    <span class="text-[13px] text-slate-500">Courses</span>
  </span>
  <span class="flex-none text-[15px] font-semibold tabular-nums text-slate-900">−23,48 €</span>
</li>
```

Comportements :

- **Scroll infini** : `useInfiniteQuery` sur `GET /accounts/{id}/transactions?page=n`. La page suivante est `_links.next.href` (HAL) et il n'y en a plus quand ce lien est absent. Le déclenchement passe par un `IntersectionObserver` sur un élément sentinelle placé environ 160 px avant la fin. Ne pas utiliser d'écouteur `scroll`.
- **Groupage par jour** fait côté client sur `bookingAt`, en fuseau `Europe/Paris`. Fusionner les pages avant de grouper, car un même jour peut être coupé entre deux pages.
- Libellés de jour : `Aujourd'hui`, `Hier`, puis `Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })` avec la première lettre en majuscule (« Mercredi 11 novembre »). Ajouter l'année si elle diffère de l'année courante.
- Total du jour à droite du titre : somme signée des montants du jour.
- Format des montants : `Intl.NumberFormat('fr-FR', { style: 'currency', currency })` sur la valeur absolue, précédé de `+` (crédit) ou `−` (U+2212, débit). L'API renvoie `amount` en **string** : le parser en décimal et ne pas faire de calcul en float pour les totaux (travailler en centimes).
- Libellé affiché : `description`. Afficher `detail` seulement s'il est utile (futur écran de détail).
- Les titres de jour restent collés en haut (`sticky top-0`) dans le conteneur scrollable, et le header du compte ne défile pas.
- États vides et erreurs : « Aucune transaction pour l'instant » si la première page est vide, et un bandeau « Synchro en cours… » si `synchronizedStatus` vaut `PENDING` ou `IN_PROGRESS`. En cas d'échec réseau, garder les lignes déjà chargées et afficher un bouton « Réessayer » à la place du skeleton.
- « Synchronisé il y a X » = `synchronizedAt`, en temps relatif (`Intl.RelativeTimeFormat('fr')`). Le point est `bg-emerald-500` si `SUCCESS` et `bg-rose-500` si `FAILED`.

---

## 5. Client API

- Base URL configurable (`VITE_API_URL`). Chaque requête envoie `Authorization: Bearer <jwt>` et `Accept: application/hal+json`.
- Auth : OAuth2 Authorization Code + PKCE sur le serveur OIDC. Le token s'obtient via `POST /oauth/token` (le proxy de l'API). Scopes requis : `account_connection:read account:read` (`:write` pour la synchro).
- HAL : les collections exposent leurs éléments dans `_embedded.item` (vérifier la clé exacte dans une vraie réponse) et la pagination dans `_links.next`. Les liens entre ressources sont aussi dans `_links` (`accounts`, `bank`, `account-connection`). Ne pas construire d'URL à la main quand le lien existe.
- Gérer `401` (rafraîchir le token ou se reconnecter) et `403` (scope manquant : message clair).

---

## 6. Changements backend nécessaires (repo Symfony dailyBudget)

Sans ces changements, les écrans ne peuvent pas afficher solde, catégorie et logo. **À faire avant ou en parallèle du front.**

1. **Solde sur `Account`**
   - Ajouter `balanceAmount` (decimal string) et `balanceCurrency`, plus éventuellement `balanceReferenceDate`, avec une migration Doctrine. Les exposer dans le groupe `account:read`.
   - Dans `AccountConnectionProcessor::syncConnection` (ou dans `AccountSyncRequestHandler`), appeler `GoCardlessClient` → `GET /accounts/{id}/balances/`. Retenir `interimAvailable` ou à défaut `closingBooked` (à documenter).
2. **Catégorie sur `Transaction`**
   - Ajouter un enum `Enum\TransactionCategory` (clés du tableau §2) et un champ `category` (défaut `other`) exposé dans `transaction:read`.
   - Le remplir dans `AccountSyncRequestHandler` avec un `TransactionCategorizer` simple : règles sur `remittanceInformationUnstructured`, `bankTransactionCode` et `creditorName`, et `income` si le montant est > 0 et ressemble à un salaire. Ajouter des tests unitaires.
3. **Tri des transactions**
   - Sur l'opération `GET /accounts/{id}/transactions` : `order: ['bookingAt' => 'DESC', 'id' => 'DESC']`, avec un index `(account_id, booking_at)`.
4. **Banque sur `AccountConnection`**
   - Stocker `bankId`, `bankName` et `bankLogo` à la création (données déjà disponibles dans `BankProvider`). Les exposer dans `account-connection:read`, ce qui évite un appel `_links.bank` par connexion.
5. **Bonus utile au front**
   - Exposer sur `AccountConnection` le nombre de comptes et éventuellement le solde agrégé, pour éviter le N+1 sur l'accueil.
   - Exposer `synchronizedAt` et `synchronizedStatus` (déjà présents) : ne pas les retirer.

Rappels de `DESIGN.md` à respecter :
- Toute nouvelle ressource possédée par un utilisateur doit être ajoutée à `CurrentUserExtension::isSupportedEntity()`.
- Renommer un URI template casse les liens HAL : vérifier avec `bin/console debug:router`.
- `GET /transactions/{id}` est cassé (le voter appelle `getOwner()`). Ce n'est pas bloquant pour ces écrans, mais à corriger avant un écran de détail de transaction.

---

## 7. Critères d'acceptation

- [ ] Accueil : connexions listées, accordéon accessible (`aria-expanded`, utilisable au clavier), comptes avec nom, IBAN masqué (4 derniers caractères) et solde.
- [ ] Les badges d'état suivent la table §2, et l'action Reconnecter ou Finaliser est présente selon l'état.
- [ ] Un clic sur un compte ouvre `/accounts/:id` ; le bouton retour ramène à l'accueil en conservant les accordéons ouverts.
- [ ] Transactions groupées par jour, triées de la plus récente à la plus ancienne, avec titre de jour collé en haut et total du jour.
- [ ] Le scroll infini charge la page suivante sans doublon et s'arrête à la dernière page.
- [ ] Skeleton pendant le chargement, état vide, état d'erreur avec Réessayer.
- [ ] Montants au format `fr-FR`, crédits en `emerald-700`, chiffres tabulaires, totaux calculés en centimes.
- [ ] Contraste ≥ 4.5:1 pour le texte et cibles tactiles ≥ 44 px.
- [ ] Rendu correct de 360 px à 430 px de large. Au-delà, contenu centré en `max-w-md mx-auto`.

---

## 8. Prompt à coller dans Claude Code

```
Lis MOBILE_UI_HANDOFF.md et DESIGN.md.
1) Confirme avec moi la stack front (proposition : React + Vite + TS + Tailwind v4 + TanStack Query + lucide-react) et l'emplacement (dossier /front du repo ou repo séparé).
2) Côté API Symfony : implémente la section 6 (solde, catégorie, tri, infos banque) avec migrations et tests, sans casser les noms de routes utilisés par les normalizers HAL.
3) Côté front : implémente les écrans Accueil et Compte selon les sections 2 à 5, avec des données mockées (MSW) d'abord, puis branche-les sur l'API.
4) Vérifie chaque critère de la section 7 et liste ceux qui restent ouverts.
```
