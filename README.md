# Library Management System

A PERN (PostgreSQL, Express, React, Node) app for a library: a librarian manages
the catalogue and processes returns, members borrow books and track their loans
and fines.

## Prerequisites

- Node.js 18+
- A PostgreSQL 14+ database (a `docker-compose.yml` is included if you don't
  have one running locally)

## 1. Start PostgreSQL

If you already have Postgres running, create an empty database called
`library` and skip to step 2.

Otherwise, from the repository root:

```bash
docker compose up -d
```

This starts Postgres on `localhost:5433` (user `postgres`, password `postgres`,
database `library`).

## 2. Backend setup

```bash
cd backend
cp .env.example .env
npm install
npm run seed    # creates the schema and inserts seed data
npm start       # starts the API on http://localhost:4000
```

`.env.example` already points at the docker-compose database
(`postgresql://postgres:postgres@localhost:5433/library`). If you're using
your own Postgres instance, edit `DATABASE_URL` in `.env` accordingly.

`npm run seed` drops and recreates all tables from `schema.sql`, then inserts
enough data to demonstrate every business rule (see `DECISIONS.md`).

### Test logins (created by the seed script)

| Role      | Email                 | Password      |
|-----------|-----------------------|---------------|
| Librarian | librarian@library.com | librarian123  |
| Member    | alice@example.com     | alice123      |
| Member    | bob@example.com       | bob123        |
| Member    | carol@example.com     | carol123      |

Alice has an overdue loan, Bob has 3 active loans (the maximum), Carol has no
loans and is free to borrow.

## 3. Frontend setup

In a second terminal:

```bash
cd client
cp .env.example .env
npm install
npm run dev     # starts the app on http://localhost:5173
```

The dev server proxies `/api` requests to `http://localhost:4000`, so no
further configuration is needed.

Open http://localhost:5173 and log in with one of the accounts above.

## 4. Running tests

```bash
cd backend
npm test
```

This runs the fine-calculation unit tests and an automated API test for R6
(the last-copy concurrency rule). The R6 test needs the Postgres database from
step 1 to be reachable; it is skipped automatically otherwise.

## Project layout

```
backend/    Express API, schema, seed script, tests
client/     React app (Vite)
schema.sql        database schema (also in backend/)
queries.sql       Q1 and Q2 SQL reports (also in backend/)
API.md            endpoint reference
DECISIONS.md      key design decisions and assumptions
AI_NOTES.md       how AI tools were used
```

## SQL reports

`backend/queries.sql` contains the two required reports (5 most borrowed books
in the last 30 days, and members with overdue loans and their total fine). The
librarian's "Reports" screen in the frontend runs the same queries through
`GET /api/reports/most-borrowed` and `GET /api/reports/overdue-fines`.
