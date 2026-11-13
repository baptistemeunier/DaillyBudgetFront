# API design

How the dailyBudget API works: who can call what, what each endpoint does, and how data flows between this API, the OAuth server and GoCardless Bank Account Data.

## Overview

```
Client ──Bearer JWT──▶ dailyBudget API ──▶ PostgreSQL
   │                        │  ▲
   │                        │  └── messenger worker (async transport, Doctrine)
   │                        ▼
   │                 GoCardless Bank Account Data API
   └──── /oauth/token (proxied) ───▶ OAuth2/OIDC server
```

- The API is stateless and has no sessions. Every request carries a Bearer JWT from the external OAuth server.
- The default format is HAL (`application/hal+json`); `application/json` and `application/ld+json` are also accepted.
- Swagger UI is served at `/` and can log in through the OAuth `authorizationCode` flow.

## Authentication

`Security\OAuthJwtAuthenticator` runs when the request has an `Authorization` header:

1. It fetches the OIDC discovery document from `OAUTH2_CONFIGURATION_URL`, then the JWKS from its `jwks_uri`. Both are cached for 10 minutes.
2. It decodes the JWT with the first key in the JWKS.
3. It rejects the token if `iss` differs from the discovery `issuer`, or if `sub` is missing. Failures return `401 {"error":"unauthorized", ...}`.

`Security\OAuthUserProvider` then:

- finds or creates a `User` whose `username` is the JWT `sub` (users are provisioned automatically on their first call);
- builds the roles from the token's `scopes` claim: `ROLE_USER` plus `ROLE_<scope>` for each scope.

| Scope | Role | Implies |
|---|---|---|
| `account_connection:read` | `ROLE_account_connection:read` | |
| `account_connection:write` | `ROLE_account_connection:write` | `…:read` |
| `account:read` | `ROLE_account:read` | |
| `account:write` | `ROLE_account:write` | `…:read` |

These roles are mirrored in `Enum\Role`; the `:write` → `:read` implication comes from `role_hierarchy` in `security.yaml`.

`POST /oauth/token` (`Controller\TokenController`) is a public pass-through to the OAuth server's token endpoint, used by the Swagger UI.

## Authorization

Every operation has a `security:` expression that calls a voter attribute. Each voter checks two things:

- **The scope role**: the user must have the read or write role for that resource type.
- **Ownership** (when there is an object): `subject.owner == current user`.

When there is no object (collection operations), the voter checks only the scope role.

| Voter attribute | Needs role | Checks owner |
|---|---|---|
| `ACCOUNT_CONNECTION_READ` | connection read | yes (on an item) |
| `ACCOUNT_CONNECTION_CREATE` | connection write | — |
| `ACCOUNT_CONNECTION_SYNC` / `_DELETE` | connection write | yes |
| `ACCOUNT_CONNECTION_CONFIGURE` | connection read | yes, and the requisition must still need user action |
| `ACCOUNT_READ` | account read | yes (on an item) |
| `TRANSACTION_ACCOUNT_READ` | delegates to `ACCOUNT_READ` on the account in the URI | |
| `TRANSACTION_READ` | account read | yes (see Known issues) |

Collections are also scoped at query level. `Doctrine\Extension\CurrentUserExtension` adds `IDENTITY(owner) = :currentUser` to every API Platform ORM query on `Account` and `AccountConnection`. **A new resource owned by a user must be added to `isSupportedEntity()`**; otherwise its collection returns every user's rows.

## Data model

```
User 1─* AccountConnection 1─* Account 1─* Transaction
  └───────────────1─* Account (owner)
```

Conventions that every entity follows:

- UUID v7 id generated in the constructor (`UuidTrait`).
- `createdAt` / `updatedAt` set by lifecycle callbacks (`TimestampableTrait`), exposed through the group `timestamp:read`.
- Soft delete (`DeletableTrait`, `deletedAt`) on `AccountConnection` and `Account`. The global Doctrine filter `soft_delete` hides deleted rows from every query.
- Values that come from GoCardless are prefixed `external*` (`externalId`, `externalStatus`, `externalUpdatedAt`, …). `externalId` is unique.
- Each resource has its own read serialization group: `account-connection:read`, `account:read`, `transaction:read`, `bank:read`.

Status enums:

- `RequisitionStatus` (on AccountConnection): the GoCardless requisition codes `CR`, `GC`, `UA`, `RJ`, `SA`, `GA`, `LN`, `EX`, `SU`. `needUserAction()` is true until the status is `LN`, `EX` or `SU`.
- `AccountStatus` (on Account): the GoCardless account status (`DISCOVERED`, `PROCESSING`, `READY`, `ERROR`, `EXPIRED`, `SUSPENDED`).
- `AccountSyncStatus` (on Account): the local sync state (`PENDING`, `IN_PROGRESS`, `FAILED`, `SUCCESS`).

## Endpoints

| Method & path | Resource / handler | Security |
|---|---|---|
| `GET /banks?country=XX` | `ApiResource\Bank` ← `State\BankProvider` | `ACCOUNT_CONNECTION_READ` |
| `GET /banks/{id}` | same | `ACCOUNT_CONNECTION_READ` |
| `GET /account_connections` | `Entity\AccountConnection` | `ACCOUNT_CONNECTION_READ` |
| `GET /account_connections/{id}` | same | `ACCOUNT_CONNECTION_READ` + owner |
| `POST /account_connections` | `AccountConnectionProcessor::createConnection` | `ACCOUNT_CONNECTION_CREATE` |
| `PATCH /account_connections/{id}/sync` | `AccountConnectionProcessor::syncConnection` | `ACCOUNT_CONNECTION_SYNC` |
| `DELETE /account_connections/{id}` | `AccountConnectionProcessor::deleteConnection` | `ACCOUNT_CONNECTION_DELETE` |
| `GET /accounts?accountConnection={uuid}` | `Entity\Account` | `ACCOUNT_READ` |
| `GET /accounts/{id}` | same | `ACCOUNT_READ` + owner |
| `GET /accounts/{id}/transactions` | `Entity\Transaction` (sub-resource) | `TRANSACTION_ACCOUNT_READ` |
| `GET /transactions/{id}` | `Entity\Transaction` | `TRANSACTION_READ` |

### Banks

`Bank` is not stored in the database. `BankProvider` loads every GoCardless institution (`GET /api/v2/institutions/`), maps each one with `Bank::fromInstitution`, and caches the result for 20 minutes. It then filters by `country` in PHP and paginates in memory with `ArrayPaginator`. `country` must be an ISO 3166-1 alpha-2 code or `XX` (the GoCardless sandbox).

### Bank connection lifecycle

1. **Create.** The client sends `POST /account_connections` with `{bankId, redirectUri}` (the `Dto\CreateAccountConnection` input). The processor creates a GoCardless requisition, using the new connection id as its `reference`, and stores `externalId`, `externalLink` and `externalStatus`.
2. **The user authorizes at the bank.** While `externalStatus.needUserAction()` is true, the HAL response includes `_links.configure`, which points to the GoCardless/bank consent page. GoCardless then redirects the user to `redirectUri`.
3. **Sync.** The client sends `PATCH /account_connections/{id}/sync` with an empty body. The processor fetches the requisition and, for each GoCardless account id in it:
   - creates or updates an `Account`, matched by `externalId`, with its name, IBAN, bank, status and `last_accessed`;
   - sets `synchronizedStatus = PENDING` and dispatches `AccountSyncRequest(accountId)` (currently this happens every time: `needAccountSync()` always returns true);
   - finally updates the connection's `externalStatus`.
4. **Delete.** `DELETE /account_connections/{id}` deletes the remote requisition and soft-deletes the connection. Its accounts are **not** soft-deleted.

### Transaction sync (async)

`Message\AccountSyncRequest` is routed to the `async` transport (Doctrine) with `max_retries: 0`. The worker `bin/console messenger:consume async` runs `MessageHandler\AccountSyncRequestHandler`:

1. Skip the account if it is missing or soft-deleted.
2. Fetch transactions from GoCardless. On the first sync it fetches the full history; after that it starts from `synchronizedAt − 5 days`, to catch late bookings.
3. Process **booked** transactions only (pending ones are not imported yet):
   - Check that the required fields are present (`bankTransactionCode`, `transactionId`, `entryReference`, `valueDate`, `remittanceInformationUnstructured`, `transactionAmount.amount`, `transactionAmount.currency`). A missing field fails the whole sync.
   - Upsert by `internalTransactionId`, which becomes `Transaction.externalId`. New rows keep the full GoCardless payload in `rawData`; `bookingAt` and `isBooked` are refreshed on every sync.
4. On success, set `synchronizedStatus = SUCCESS` and `synchronizedAt = now`. On failure, reset the entity manager, reload the account and set `synchronizedStatus = FAILED`.

## GoCardless client

`Client\GoCardlessClient` is the only code that calls GoCardless (`GOCARDLESS_BASE_URL`):

- It gets an access token from `/api/v2/token/new/` using `GOCARDLESS_CLIENT_ID` and `GOCARDLESS_CLIENT_SECRET`, and caches it.
- On a 401 it retries the request once.
- It covers requisitions (create, get, delete), accounts (get, balances, details, transactions) and institutions.

## HAL links

Related resources are linked through `_links`, not embedded as IRIs. Each link is added by a decorating normalizer in `src/Serializer/` (priority 64, guarded against re-entry with an `ALREADY_CALLED` context flag):

| Resource | Links |
|---|---|
| AccountConnection | `configure` (external consent URL, only while user action is needed), `bank`, `accounts` (only if the user can `ACCOUNT_READ`) |
| Account | `account-connection`, `bank` |

The links are generated from API Platform route names such as `_api_/banks/{id}{._format}_get` and `_api_/accounts{._format}_get_collection`. **Renaming a URI template or an operation breaks these route names.** Run `bin/console debug:router` to check them.

## Known issues / TODO

- `TransactionVoter::voteOnItem` calls `$subject->getOwner()`, but `Transaction` has no `owner`. `GET /transactions/{id}` will error until ownership is resolved through `transaction.account.owner`.
- The catch-all `access_control` rule `^/ → IS_AUTHENTICATED_FULLY` is commented out, so access control relies only on each operation's `security`.
- `needAccountSync()` always returns true, so every `/sync` re-queues every account.
- Pending (not yet booked) transactions are not imported.
- Soft-deleting a connection does not cascade to its accounts.
