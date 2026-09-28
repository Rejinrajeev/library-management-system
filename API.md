# API Reference

Base URL: `http://localhost:4000/api`

All endpoints except `/auth/register` and `/auth/login` require a header:

```
Authorization: Bearer <token>
```

## Error format

Every rejected request returns a JSON body of the shape:

```json
{ "error": { "code": "SOME_CODE", "message": "Human readable message." } }
```

Common status codes: `400` validation error, `401` missing/invalid token,
`403` wrong role, `404` not found, `409` conflict / business rule violation,
`500` unexpected error.

---

## Auth

### POST /auth/register
Who: anyone (creates a **member** account).

Request:
```json
{ "name": "Dana", "email": "dana@example.com", "password": "secret123" }
```
Response `201`:
```json
{ "user": { "id": 5, "name": "Dana", "email": "dana@example.com", "role": "member" }, "token": "..." }
```
Errors: `400 VALIDATION_ERROR`, `409 EMAIL_TAKEN`.

### POST /auth/login
Who: anyone.

Request:
```json
{ "email": "alice@example.com", "password": "alice123" }
```
Response `200`: same shape as register.
Errors: `400 VALIDATION_ERROR`, `401 INVALID_CREDENTIALS`.

---

## Books

### GET /books?search=&page=&pageSize=
Who: any authenticated user. Lists books with copy counts, paginated (the
catalogue is expected to grow to 50,000 books, so this never loads the whole
table). `page` defaults to 1, `pageSize` defaults to 20 and is capped at 100.

Response `200`:
```json
{
  "books": [{ "id": 1, "isbn": "9780132350884", "title": "Clean Code", "author": "Robert C. Martin", "available_copies": 2, "total_copies": 2 }],
  "total": 8, "page": 1, "pageSize": 20, "totalPages": 1
}
```

### GET /books/:id
Who: any authenticated user. Book detail plus its copies.

Response `200`:
```json
{
  "id": 1, "isbn": "9780132350884", "title": "Clean Code", "author": "Robert C. Martin", "available_copies": 2,
  "copies": [{ "id": 1, "copy_code": "CC-1", "condition": "good", "on_loan": false }]
}
```
Errors: `404 NOT_FOUND`.

### POST /books
Who: librarian only. Creates a book.

Request:
```json
{ "isbn": "9780132350884", "title": "Clean Code", "author": "Robert C. Martin" }
```
Response `201`: the created book. Errors: `400 VALIDATION_ERROR`, `403 FORBIDDEN`, `409 ISBN_TAKEN`.

### PUT /books/:id
Who: librarian only. Any of `isbn`, `title`, `author` may be supplied.
Response `200`: the updated book. Errors: `403 FORBIDDEN`, `404 NOT_FOUND`, `409 ISBN_TAKEN`.

### DELETE /books/:id
Who: librarian only. Rejected if the book (or any of its copies) has ever been
lent (R8).
Response: `204` on success. Errors: `403 FORBIDDEN`, `404 NOT_FOUND`,
`409 BOOK_HAS_LOAN_HISTORY`.

### POST /books/:id/copies
Who: librarian only. Adds a copy to a book.

Request:
```json
{ "copyCode": "CC-3", "condition": "good" }
```
Response `201`: the created copy. Errors: `400 VALIDATION_ERROR`, `403 FORBIDDEN`, `404 NOT_FOUND`, `409 COPY_CODE_TAKEN`.

---

## Copies

### PUT /copies/:id
Who: librarian only. Updates a copy's condition.

Request:
```json
{ "condition": "damaged" }
```
Response `200`: the updated copy. Errors: `400 VALIDATION_ERROR`, `403 FORBIDDEN`, `404 NOT_FOUND`.

### DELETE /copies/:id
Who: librarian only. Rejected if the copy has ever been lent.
Response: `204` on success. Errors: `403 FORBIDDEN`, `404 NOT_FOUND`, `409 COPY_HAS_LOAN_HISTORY`.

---

## Loans

### GET /loans?status=&memberId=
Who: any authenticated user.
- Members always see only their own loans (`memberId` is ignored for them).
- Librarians see all loans, optionally filtered by `status` (`active` |
  `overdue` | `returned`) and/or `memberId`.

Response `200`:
```json
[{
  "id": 4, "member_id": 2, "copy_id": 8, "borrow_date": "2026-09-08", "due_date": "2026-09-22",
  "return_date": null, "return_condition": null, "fine_amount": null,
  "book_id": 6, "title": "Introduction to Algorithms", "author": "Cormen et al.", "isbn": "9780262033848",
  "copy_code": "AL-1", "member_name": "Alice", "member_email": "alice@example.com",
  "is_overdue": true, "current_fine": 60, "days_late": 6
}]
```
`current_fine` is the stored `fine_amount` once returned, otherwise the fine
computed as of today.

### POST /loans
Who: member only. Borrows a book (R2); the system assigns an available copy.

Request:
```json
{ "bookId": 7 }
```
Response `201`: the created loan.
Errors:
- `400 VALIDATION_ERROR` — missing bookId
- `404 NOT_FOUND` — book does not exist
- `409 HAS_OVERDUE_LOAN` — member has an overdue loan (R4)
- `409 LOAN_LIMIT_REACHED` — member already has 3 loans (R3)
- `409 ALREADY_BORROWED` — member already has this book on loan (R5)
- `409 NO_COPY_AVAILABLE` — no available copy of this book (R2)

### POST /loans/:id/return
Who: librarian only (R7). Records the return date, fine and copy condition.

Request:
```json
{ "condition": "good" }
```
Response `200`: the updated loan, plus `reservationFulfilled` (`null`, or
`{ memberId }` if returning this copy in good condition immediately re-lent it
to the next member in that book's reservation queue — see Reservations below).
Errors: `400 VALIDATION_ERROR`, `403 FORBIDDEN`, `404 NOT_FOUND`,
`409 ALREADY_RETURNED`.

---

## Reservations (stretch goal)

### GET /reservations
Who: any authenticated user. Members see only their own; librarians see all
(optionally filtered by `?bookId=`). Waiting reservations are listed before
fulfilled ones; `queue_position` counts how many waiting reservations for the
same book (including this one) were made on or before it.

Response `200`:
```json
[{
  "id": 1, "book_id": 2, "title": "The Pragmatic Programmer", "author": "David Thomas & Andrew Hunt",
  "member_id": 4, "member_name": "Carol", "created_at": "2026-09-28T05:40:10.157Z",
  "fulfilled_at": null, "queue_position": 1
}]
```

### POST /reservations
Who: member only. Joins the reservation queue for a book — only allowed when
**no** copy is currently available (otherwise just borrow it).

Request:
```json
{ "bookId": 2 }
```
Response `201`: the created reservation.
Errors:
- `400 VALIDATION_ERROR` — missing bookId
- `404 NOT_FOUND` — book does not exist
- `409 COPY_AVAILABLE` — a copy is available; borrow instead of reserving
- `409 ALREADY_BORROWED` — member already has this book on loan
- `409 ALREADY_RESERVED` — member already has an active reservation for this book

When a librarian returns a loan for this book in `good` condition
(`POST /loans/:id/return`), the copy is not made generally available if
anyone is waiting: it is immediately re-lent to whoever is first in the
queue, and that return's response includes `reservationFulfilled: { memberId }`.

---

## Reports

### GET /reports/most-borrowed
Who: librarian only. Q1 — the 5 most borrowed books in the last 30 days.

Response `200`:
```json
[{ "id": 5, "title": "The Mythical Man-Month", "author": "Frederick P. Brooks", "borrow_count": 1 }]
```

### GET /reports/overdue-fines
Who: librarian only. Q2 — members with overdue loans and the total fine each
would owe if returned today.

Response `200`:
```json
[{ "member_id": 2, "name": "Alice", "email": "alice@example.com", "overdue_loans": 1, "total_fine": 60 }]
```
