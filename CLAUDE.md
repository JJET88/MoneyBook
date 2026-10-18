# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Money Book is a personal spending notebook: Next.js 16 (App Router, Server Components, Server Actions), React 19, MySQL 8 via `mysql2`, plain CSS, plain JavaScript (ES modules, no TypeScript). Node 22+. The only dependencies are `next`, `react`, `react-dom` and `mysql2`. Auth, validation and money arithmetic are hand-written in `lib/`; keep it that way rather than adding libraries.

## Commands

```bash
npm run dev          # http://localhost:3000
npm run build
npm run db:setup     # apply lib/schema.sql (idempotent; safe to rerun)
npm run seed         # demo account with made-up entries; prints its login
npm test             # node --test "test/*.test.js"
node --test test/units.test.js                          # one file
node --test --test-name-pattern="carries" test/units.test.js   # one test by name
```

Config lives in `.env.local` (see `.env.example`): `MYSQL_*` and `APP_TIME_ZONE` (IANA zone that defines "today"/"this month" on the server; the add form then corrects to the browser's date). Optional `MYSQL_SSL=true` and `MYSQL_CONNECTION_LIMIT` are for hosted/serverless databases. `lib/db.js` loads `.env.local` itself when run outside Next.js (scripts, tests).

Adding a table means adding it to `lib/schema.sql` (statements are split on `;` with `--` comments stripped, so neither may appear inside a statement) and to the drop list at the top of `test/db.test.js`.

Database tests in `test/db.test.js` are skipped unless `MYSQL_TEST_DATABASE` is set. They **drop and recreate all tables**, so only point them at an empty throwaway database:

```bash
MYSQL_TEST_DATABASE=moneybook_test MYSQL_TEST_USER=moneybook MYSQL_TEST_PASSWORD=... npm test
```

Docker (`docker compose up --build`) exists but per the README has never actually been run.

## Architecture

Request flow: a Server Component page (`app/page.js` = Days, `app/year/page.js`, `app/history/page.js`, `app/settings/page.js`) reads via `lib/repos/*`, passes rows to pure functions in `lib/book.js` (money left, quick choices, year table), and renders. Only `components/` are Client Components. Every mutation goes through a Server Action in `app/actions.js`, which: gets the user (`signedIn()`), validates with `lib/validate.js`, writes via `lib/repos`, then calls `revalidatePath("/", "layout")`. Actions return `{ error }` rather than throwing; `redirect()` must stay outside the `try` because it works by throwing. `app/api/backup` and `app/api/export` are GET routes for JSON backup and CSV export (`lib/backup.js`); `app/api/health` is a DB health check.

Invariants to preserve:

- **Money is integer minor units** (`amount_minor`, 6550 = 65.50). Parse user text with `lib/money.js`, never `Number()`/floats. Two decimal places are assumed for every currency.
- **Dates are `"YYYY-MM-DD"` strings**, never `Date` objects. The pool uses `dateStrings: true`; date helpers are in `lib/dates.js`.
- **Every repo query is scoped by user id** in its `WHERE` clause. Updating/deleting another user's row affects zero rows and is reported as not-found (`notFound()` in `lib/errors.js`), never as forbidden.
- **Aggregation happens in SQL** (`GROUP BY` month); JS only does the running balance over those rows. Entries dated on or before the settings `start_date` are shown but not counted, since they're already inside the starting balance. "Left" is `null` (rendered as "?") when there is nothing to count from, rather than a misleading negative.
- **Every change to a book writes a `history` line in the same transaction** (`record(run, …)` from `lib/repos/history.js`, passing the transaction's `run`). Entry lines store a snapshot `{ date, kind, label, amountMinor }` in `detail` so they still read after the entry is gone; saves with no change record nothing. New actions need an `action.<name>` i18n key and, if they carry detail, a case in `describeHistory` (`lib/history.js`). History timestamps (`at`) are epoch ms, shown in `APP_TIME_ZONE`.
- **Multi-statement writes use `withTransaction`** from `lib/db.js` (e.g. backup restore must leave the old book intact on failure).
- **Backup files are untrusted input**: restore reads only known fields and validates each line; CSV export prefixes labels starting with `= + - @` with an apostrophe.
- The DB pool is cached on `globalThis` to survive dev hot reloads; don't create pools elsewhere.
- Auth (`lib/auth/`): scrypt hashes with params embedded; session cookie (`httpOnly`, `SameSite=Lax`, `Secure` when `NODE_ENV=production`, so non-localhost hosts need HTTPS) holds a random token, DB stores only its SHA-256. Unknown-email logins call `wasteTimeLikeAVerify` so timing and message match a wrong password. Rate limiting (`lib/limiter.js`) records the attempt *before* counting it (so concurrent bursts can't slip through) and stores attempts in the `attempts` table (`lib/repos/attempts.js`, SHA-256 of the key) so limits survive restarts and multiple processes; `memoryStore()` is for tests. Per-address limits use `clientAddress()`, which reads `X-Forwarded-For` from the right, skipping `TRUSTED_PROXIES` hops (default 1): Next.js forwards a client-supplied header unchanged, so the leftmost entry is never trustworthy. Writes that must not change log-in timing (the failed-log-in history line) go in `after()`.

### Errors and i18n

User-facing errors are `AppError(status, key, vars)` where `key` is an i18n message key; `failure()` in `actions.js` translates it into the user's language. Any other thrown error is logged and shown as `err.server`.

Translations live in `lib/i18n/{en,my,th,zh}.js` as flat `key → string` maps (`{name}` placeholders, `{ one, other }` for plurals). `en.js` is the base; other languages are merged on top, so missing keys fall back to English. When adding UI text, add the key to `en.js` (and other languages where possible). `translate.js` is shared by server and client and must not import the dictionaries; server code uses `getT()` from `lib/i18n/server.js` (language from the `lang` cookie, else `Accept-Language`), client components use `useT()` from `components/I18n.js`, which receives only the current language's messages from the layout. `{placeholders}` left unfilled are filled with links by `components/Rich.js`.

Imports use the `@/` alias for the project root (`jsconfig.json`). `mysql2` is kept out of the bundler via `serverExternalPackages`; Server Action body limit is raised to 2 MB for backup restores (`next.config.mjs`).
