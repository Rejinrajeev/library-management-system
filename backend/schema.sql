-- Library Management System schema

DROP TABLE IF EXISTS loans CASCADE;
DROP TABLE IF EXISTS copies CASCADE;
DROP TABLE IF EXISTS books CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('librarian', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE books (
  id SERIAL PRIMARY KEY,
  isbn TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE copies (
  id SERIAL PRIMARY KEY,
  book_id INTEGER NOT NULL REFERENCES books(id),
  copy_code TEXT NOT NULL UNIQUE,
  condition TEXT NOT NULL DEFAULT 'good' CHECK (condition IN ('good', 'damaged', 'lost')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE loans (
  id SERIAL PRIMARY KEY,
  copy_id INTEGER NOT NULL REFERENCES copies(id),
  member_id INTEGER NOT NULL REFERENCES users(id),
  borrow_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  return_date DATE,
  return_condition TEXT CHECK (return_condition IN ('good', 'damaged', 'lost')),
  fine_amount INTEGER, -- rupees, set on return
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_copies_book_id ON copies(book_id);
CREATE INDEX idx_loans_copy_id ON loans(copy_id);
CREATE INDEX idx_loans_member_id ON loans(member_id);
-- Speeds up "find available copy" / "active loans" checks (return_date IS NULL)
CREATE INDEX idx_loans_active ON loans(copy_id) WHERE return_date IS NULL;
