# AI Usage Notes

Claude (Claude Code) was used to write the entire application — schema,
backend, frontend, tests and documentation — from the machine test's PDF
brief, with the candidate reviewing and directing each step.

## What the AI got wrong and had to fix

While verifying the app end-to-end against a real Postgres instance, the
fine amount for the same overdue loan disagreed between two endpoints:
`GET /loans?status=overdue` reported Rs 70 for a loan that `GET
/reports/overdue-fines` (Q2) reported as Rs 60 for.

Root cause: node-postgres's default parser turns a `DATE` column into a JS
`Date` object using the **host machine's local timezone**, but the fine
calculator was extracting the calendar date back out with the UTC getters
(`getUTCFullYear`/etc.). On a host whose local timezone isn't UTC, those two
steps disagree by a day around certain times, and the discrepancy compounded
with Postgres's own `CURRENT_DATE` (originally left on the server's default
timezone, not the IST the spec requires).

The fix: pin the Postgres session timezone to `Asia/Kolkata` (`options: '-c
timezone=Asia/Kolkata'` on the pool), and install a custom type parser so
`DATE` columns come back as plain `'YYYY-MM-DD'` strings instead of `Date`
objects, removing the timezone ambiguity entirely. `backend/src/utils/fine.js`
parses those strings directly. This is called out in `DECISIONS.md` point 4.

This wasn't caught by the unit tests (`fine.test.js`), which only exercised
`calculateFine` with fixed strings — it only surfaced by running the seeded
app against a real database and cross-checking two endpoints that should
agree, which is why that check is part of this submission's verification
rather than something to take on faith from passing unit tests alone.

## Other AI-assisted work

- Generating the initial Express route structure, the transactional
  `FOR UPDATE SKIP LOCKED` borrow logic for R6, and the React pages, then
  iterating based on manual API testing with `curl` against the seeded
  database (see the R2–R8 checks run during development).
- Drafting this documentation set (`README.md`, `API.md`, `DECISIONS.md`)
  from the implemented code, cross-checked against the actual route
  definitions rather than written from memory of the spec alone.
