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
- Let AP delete invoices, related records, and stored invoice files.
- Restrict department users to their own department invoices with separate work and history views.
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
# POSTGRES_URL= can be used instead when Vercel/Neon provides that name.
BLOB_READ_WRITE_TOKEN=
# Optional. Defaults to public for Vercel Blob public stores. Set to private only if your Blob store is configured for private access.
BLOB_ACCESS=public
```

When `DATABASE_URL` or a common Vercel Postgres URL variable is configured, the MVP stores application data in Postgres. Without Postgres configuration, it falls back to local `data/` for development. When `BLOB_READ_WRITE_TOKEN` is configured, uploaded invoice files are stored in Vercel Blob. Public Blob stores work with the default `BLOB_ACCESS=public`; private stores require `BLOB_ACCESS=private`. Without Blob configuration, file uploads fall back to local `uploads/` for development. The AP dashboard shows which storage mode is active so production fallback is visible. The current MVP table plus the target normalized schema are documented in `database/schema.sql`.

## Verification

```bash
npm run lint
npx tsc --noEmit
```

`npm run build` may be blocked on this Windows setup by `spawn EPERM` after compile/type-check. That is an environment process-spawn restriction, not a TypeScript or lint failure.
