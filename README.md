# Invoice Management MVP

Cloud-ready AP invoice workflow prototype built with Next.js.

## What It Does

- Upload PO lists from CSV or Excel with PO number, vendor, and department.
- Upload invoice PDFs/images.
- Extract invoice metadata through Azure Document Intelligence when configured.
- Fall back to local filename-based metadata extraction for first-run demos.
- Match PO numbers case-insensitively and route matched invoices to departments.
- Send mock department notifications until SMTP settings are added.
- Sign in with seeded app-only demo accounts.
- Maintain department names and notification emails in AP setup.
- Let departments submit decisions:
  - Receiving Record
  - P-Card
  - Request for Check
  - Reject
  - Hold
  - Not our Department Invoice
- Return `Not our Department Invoice` items to AP as `Needs AP Rework`.

## Run Locally

```bash
npm run dev
```

Open `http://localhost:3000`.

The default `dev` script uses `dev-server.js`, a single-process launcher that avoids a Windows process-spawn restriction seen on this machine. The normal Next.js command is still available:

```bash
npm run next:dev
```

## Production Settings

Set these environment variables when connecting real services:

```bash
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=
AZURE_DOCUMENT_INTELLIGENCE_KEY=
NEXT_PUBLIC_APP_URL=
SMTP_HOST=
EMAIL_FROM=
DATABASE_URL=
```

This MVP currently persists demo data to local `data/` and invoice files to local `uploads/`. Those folders are ignored by Git. The data access layer is isolated in `src/lib/store.ts` so it can be replaced with Postgres when the database is provisioned. The starting Postgres schema is in `database/schema.sql`.

## Verification

```bash
npm run lint
npx tsc --noEmit
```

`npm run build` may be blocked on this Windows setup by `spawn EPERM` after compile/type-check. That is an environment process-spawn restriction, not a TypeScript or lint failure.
