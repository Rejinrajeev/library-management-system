# Design Decisions

1. **Availability is derived, not stored.** A copy has no `status` column; a
   copy is "available" when its `condition = 'good'` and there is no `loans`
   row for it with `return_date IS NULL`. This avoids two sources of truth
   (a status flag and the loan history) ever disagreeing.

2. **R6 (exactly one borrow wins the last copy) is guaranteed with
   `SELECT ... FOR UPDATE SKIP LOCKED` inside a transaction**, not with an
   application-level mutex or a unique constraint. The borrow endpoint opens a
   transaction, locks a single available copy row, and inserts the loan
   before committing. If two requests race for the same last copy, the first
   to reach the `SELECT` locks that row; `SKIP LOCKED` makes the second
   request's query skip it entirely, see no other available copies, and fail
   with `409 NO_COPY_AVAILABLE` — instead of blocking and then failing on a
   constraint. This is verified by an automated test
   (`backend/tests/r6-concurrency.test.js`) that fires two simultaneous borrow
   requests for a book with a single copy and asserts exactly one succeeds.

3. **The member's own row is locked first (`SELECT ... FOR UPDATE` on
   `users`)** before checking their loan count, overdue status and existing
   loans for the same book. This serializes a single member's simultaneous
   borrow attempts so R3/R4/R5 can't be bypassed by racing the same account
   the way R6 covers racing between two different members.

4. **Dates are handled as plain `YYYY-MM-DD` strings end-to-end**, not JS
   `Date` objects, once they leave Postgres. node-postgres's default date
   parser builds a `Date` from the host machine's local timezone, which made
   "days late" calculations depend on where the process happened to run. A
   custom type parser (`backend/src/db/pool.js`) keeps `DATE` columns as raw
   strings, and the Postgres session timezone is pinned to `Asia/Kolkata` so
   `CURRENT_DATE` matches the spec's "all dates are in IST". The fine
   calculator (`backend/src/utils/fine.js`) parses those strings directly
   instead of round-tripping through `Date`.

5. **Fine calculation is a pure, standalone function** (`calculateFine(due,
   returned)` in `backend/src/utils/fine.js`) with no DB or HTTP dependency,
   so it's unit-testable in isolation (`backend/tests/fine.test.js`) and is
   the single place the Rs 10/day rule is implemented — both the return
   endpoint and the "current fine" shown on active loans call it.

6. **Loan history is immutable.** Returns update the existing loan row
   (`return_date`, `return_condition`, `fine_amount`) rather than inserting a
   new record, and there is no delete endpoint for loans. Deleting a book or
   copy is blocked once any loan references it (R8), checked via `EXISTS`
   against `loans`.

7. **Members borrow a book, the API assigns the copy (R2).** The frontend
   never sends a `copyId`; `POST /loans` only takes `bookId`, keeping copy
   assignment entirely server-side so a client can't pick a specific copy
   (e.g. a damaged one) or bypass availability checks.

8. **Passwords are hashed with bcrypt (cost 10)**; auth is a stateless JWT
   (12h expiry) carrying `id`, `name`, `email`, `role`. Role checks are a
   separate `requireRole` middleware from `requireAuth`, so every route
   states explicitly who can call it (also documented per-endpoint in
   `API.md`).

## Assumptions

- "Members borrow a book, not a specific copy" (R2) means the frontend never
  exposes per-copy selection to members; only the librarian's catalogue screen
  shows individual copies.
- A copy that is `damaged` or `lost` is simply excluded from "available" — no
  separate workflow is needed to un-lend it, since it can't be on loan while
  in that condition (it would have been returned to reach that condition).
- ISBN and copy code uniqueness (R1) are enforced with `UNIQUE` constraints in
  the schema, not just application checks, to satisfy the automatic-fail
  requirement around real constraints (SQL injection is avoided the same way —
  all queries use parameterised `$1, $2, ...` placeholders, never string
  concatenation).
- "Whole calendar days late" is computed as the difference between the due
  date and return date at midnight IST, rounded to the nearest day (there is
  no fractional day case since both are DATE values).

## Incomplete / out of scope

- The reservation queue stretch goal is not implemented.
- No pagination on `GET /books` — acceptable for a demo seed, but would need
  addressing before the catalogue actually reaches 50,000 books.
- No password reset / email verification flow (not requested).
