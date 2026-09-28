require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const pool = require('./pool');

async function run() {
  const schema = fs.readFileSync(path.join(__dirname, '..', '..', 'schema.sql'), 'utf8');
  await pool.query(schema);

  const passwordHash = (pw) => bcrypt.hash(pw, 10);

  const librarian = await pool.query(
    `INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,'librarian') RETURNING id`,
    ['Librarian', 'librarian@library.com', await passwordHash('librarian123')]
  );
  const alice = await pool.query(
    `INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,'member') RETURNING id`,
    ['Alice', 'alice@example.com', await passwordHash('alice123')]
  );
  const bob = await pool.query(
    `INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,'member') RETURNING id`,
    ['Bob', 'bob@example.com', await passwordHash('bob123')]
  );
  const carol = await pool.query(
    `INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,'member') RETURNING id`,
    ['Carol', 'carol@example.com', await passwordHash('carol123')]
  );

  async function addBook(isbn, title, author) {
    const r = await pool.query(
      `INSERT INTO books (isbn, title, author) VALUES ($1,$2,$3) RETURNING id`,
      [isbn, title, author]
    );
    return r.rows[0].id;
  }
  async function addCopy(bookId, copyCode, condition = 'good') {
    const r = await pool.query(
      `INSERT INTO copies (book_id, copy_code, condition) VALUES ($1,$2,$3) RETURNING id`,
      [bookId, copyCode, condition]
    );
    return r.rows[0].id;
  }
  async function addLoan(copyId, memberId, borrowDaysAgo, returnDaysAgo, returnCondition, fineAmount) {
    const borrowDate = `CURRENT_DATE - INTERVAL '${borrowDaysAgo} days'`;
    const dueDate = `(CURRENT_DATE - INTERVAL '${borrowDaysAgo} days') + INTERVAL '14 days'`;
    if (returnDaysAgo === null) {
      await pool.query(
        `INSERT INTO loans (copy_id, member_id, borrow_date, due_date)
         VALUES ($1, $2, ${borrowDate}, ${dueDate})`,
        [copyId, memberId]
      );
    } else {
      const returnDate = `CURRENT_DATE - INTERVAL '${returnDaysAgo} days'`;
      await pool.query(
        `INSERT INTO loans (copy_id, member_id, borrow_date, due_date, return_date, return_condition, fine_amount)
         VALUES ($1, $2, ${borrowDate}, ${dueDate}, ${returnDate}, $3, $4)`,
        [copyId, memberId, returnCondition, fineAmount]
      );
    }
  }

  const cleanCode = await addBook('9780132350884', 'Clean Code', 'Robert C. Martin');
  const cc1 = await addCopy(cleanCode, 'CC-1');
  const cc2 = await addCopy(cleanCode, 'CC-2');

  const pragmatic = await addBook('9780135957059', 'The Pragmatic Programmer', 'David Thomas & Andrew Hunt');
  const pp1 = await addCopy(pragmatic, 'PP-1');

  const designPatterns = await addBook('9780201633610', 'Design Patterns', 'Gang of Four');
  const dp1 = await addCopy(designPatterns, 'DP-1');
  const dp2 = await addCopy(designPatterns, 'DP-2', 'damaged');

  const refactoring = await addBook('9780134757599', 'Refactoring', 'Martin Fowler');
  const rf1 = await addCopy(refactoring, 'RF-1');

  const mythical = await addBook('9780201835953', 'The Mythical Man-Month', 'Frederick P. Brooks');
  const mm1 = await addCopy(mythical, 'MM-1');

  const algorithms = await addBook('9780262033848', 'Introduction to Algorithms', 'Cormen et al.');
  const al1 = await addCopy(algorithms, 'AL-1');

  const database = await addBook('9780073523323', 'Database System Concepts', 'Silberschatz et al.');
  await addCopy(database, 'DB-1');

  const effectiveJava = await addBook('9780134685991', 'Effective Java', 'Joshua Bloch');
  await addCopy(effectiveJava, 'EJ-1', 'lost');

  // Bob: 3 active loans -> at the R3 limit
  await addLoan(pp1, bob.rows[0].id, 5, null);
  await addLoan(rf1, bob.rows[0].id, 3, null);
  await addLoan(mm1, bob.rows[0].id, 1, null);

  // Alice: one overdue active loan -> R4 (cannot borrow while overdue)
  await addLoan(al1, alice.rows[0].id, 20, null);

  // Carol: past returned loans (recent, for Q1 report) -> currently free to borrow
  await addLoan(cc2, carol.rows[0].id, 10, 2, 'good', 0);
  await addLoan(dp2, carol.rows[0].id, 25, 9, 'damaged', 20);

  console.log('Seed complete.');
  console.log('Librarian login: librarian@library.com / librarian123');
  console.log('Member logins: alice@example.com/alice123, bob@example.com/bob123, carol@example.com/carol123');
  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
