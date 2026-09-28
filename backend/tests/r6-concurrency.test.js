/**
 * R6: if two members try to borrow the last available copy at the same
 * moment, exactly one succeeds. Needs a running Postgres (see README) and the
 * seeded schema; skipped automatically if the DB is unreachable.
 */
require('dotenv').config();
const pool = require('../src/db/pool');
const bcrypt = require('bcrypt');
const request = require('http');
const app = require('../src/app');

let server;
let baseUrl;

async function json(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = request.request(
      `${baseUrl}${path}`,
      {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => resolve({ status: res.statusCode, body: raw ? JSON.parse(raw) : null }));
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

describe('R6 - concurrent borrow of the last available copy', () => {
  let bookId;
  let memberA;
  let memberB;

  beforeAll(async () => {
    try {
      await pool.query('SELECT 1');
    } catch (err) {
      console.warn('Skipping R6 test: Postgres is not reachable.');
      return;
    }

    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://localhost:${server.address().port}`;

    const book = await pool.query(
      `INSERT INTO books (isbn, title, author) VALUES ($1, $2, $3) RETURNING id`,
      [`r6-test-${Date.now()}`, 'R6 Race Test Book', 'Test Author']
    );
    bookId = book.rows[0].id;
    await pool.query(`INSERT INTO copies (book_id, copy_code) VALUES ($1, $2)`, [bookId, `R6-${Date.now()}`]);

    const hash = await bcrypt.hash('password123', 4);
    const a = await pool.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ('R6 A', $1, $2, 'member') RETURNING id`,
      [`r6a-${Date.now()}@example.com`, hash]
    );
    const b = await pool.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ('R6 B', $1, $2, 'member') RETURNING id`,
      [`r6b-${Date.now()}@example.com`, hash]
    );
    memberA = a.rows[0].id;
    memberB = b.rows[0].id;
  });

  afterAll(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    await pool.end();
  });

  test('exactly one of two simultaneous borrows succeeds', async () => {
    if (!baseUrl) return; // DB unreachable; test skipped in beforeAll

    const jwt = require('jsonwebtoken');
    const sign = (id) => jwt.sign({ id, role: 'member' }, process.env.JWT_SECRET, { expiresIn: '5m' });

    const [resA, resB] = await Promise.all([
      json('POST', '/api/loans', { bookId }, sign(memberA)),
      json('POST', '/api/loans', { bookId }, sign(memberB)),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([201, 409]);
  });
});
