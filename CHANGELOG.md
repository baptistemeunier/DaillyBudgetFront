# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed
- Sign-in goes through Authelia (auth.home.meunier.ovh) as a public client with PKCE, without a client secret.
- The refresh token is kept in an httpOnly cookie instead of the browser storage.

### Added
- A sign-out button on the profile page. It revokes the refresh token and closes the Authelia session.

## [0.1.0] - 2026-11-20

First release.

### Added

#### Home and accounts
- A home page with a carousel of the actions to do.
- Accounts show their display name, then their bank name, then "Compte sans nom".
- The bank balance of each account, with its date.
- Manual savings and investment accounts, whose balance can be updated by hand.

#### Banks
- Profile pages to manage bank connections.
- After the bank consent, the page follows the sync of the accounts.

#### Transactions
- Categorize a transaction, including across several categories.
- A "to categorize" page with bulk categorization.
- A "Transfert" tab: a transfer to a savings account can be split across several envelopes.
- The bank details of a transaction are shown above the categorization tabs.
- Review the transactions categorized by a rule.
- Remember a merchant's category, and manage the categorization rules from the profile.
- Hide a transaction from the budget.

#### Budget and savings
- A budget edit page and a bottom navigation bar.
- A budget statement for the period, with drill-down by category.
- The uncategorized row comes first, and only shows the selected period.
- An "Épargne" tab with the savings envelopes.
- Category icons (Lucide), colored the same way in the budget and in the savings.
- Custom categories and envelopes, managed from the profile.

#### Notifications
- The inbox, a bell icon, the notification settings and the low balance threshold.
- Web Push on the device, with the text written by the service worker.
- Balance, transaction and budget alerts, each with its own settings.

#### Sharing
- Actions on shared data (delete, sync, configure) are only shown to the users the API allows.

#### Platform
- The interface is in French and English, with a language switch in the profile.
- An installable PWA.
- OAuth sign-in. The server exchanges the code for a token and proxies the API calls.

### Fixed
- Banks: when the consent was not completed, the app offers to start the connection again.
- Sign-in: no more login loop when the stored token expired and there was no refresh token.

### Commits

- 27b8c48 feat(accounts): update the balance of a manual account
- fcca13e feat(sharing): show the actions on shared data only to users the API allows
- 3887d3f feat(connections): follow the accounts sync after the bank consent callback
- f241ca2 fix(auth): stop the login loop when the stored token expired without a refresh token
- 6fac750 feat(transactions): hide a transaction from the budget
- 23e0cb4 feat(transfer): split a transfer to a savings account across several envelopes
- 8518f0c feat(categories): color the category icons like the budget and the savings
- 457e422 feat(budget): show the uncategorized row first
- 3f9d468 feat(budget): show only the uncategorized transactions of the selected period
- 13ae7e9 feat(notifications): show the balance, transaction and budget alerts, with their settings
- f0bfdf7 feat(notifications): receive Web Push on the device, with the text written by the front
- 8137bad feat(notifications): add the inbox, the bell, the notification settings and the low balance threshold
- 8e80141 feat(transactions): review the transactions categorized by a rule
- ddd3684 feat(rules): remember a merchant's category and manage the categorization rules from the profile
- fafcaf4 feat(transactions): show the bank detail above the categorize tabs
- 94bf648 fix(banks): offer to restart the connection when the consent was not completed
- 4f33a6e feat(categories): manage custom categories and envelopes from the profile
- 8a64213 feat(pwa): make the app installable using PWA
- beee43e feat(i18n): add French/English UI with language switcher in profile
- 5d58692 feat(savings): add Épargne tab with envelopes, Lucide category icons
- 9edb587 feat(transactions): saving envelopes on savings accounts, account on to-categorize rows
- 3411dbe feat(accounts): add manual accounts and a Transfert tab to categorization
- c7a81fc feat(profile): add profile and bank connection management pages
- 043c81c feat(accounts): show bank balance and its date from API
- 6657dbb feat(budget): add budget statement view with category drill-down
- a7aba77 feat(budget): add budget edit page and bottom navigation
- f74e1e6 feat(transactions): add to-categorize page with bulk categorization
- 6981add feat(user-action): add todo carousel on home page
- 40f2540 feat(transactions): categorize transactions with splits
- 38d4cae feat(accounts): show displayName, then name, else "Compte sans nom"
- 07bd901 chore(init): first commit
