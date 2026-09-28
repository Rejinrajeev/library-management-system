const { Pool, types } = require('pg');

// node-postgres otherwise turns DATE columns into JS Date objects using the
// host machine's local timezone, which makes "day" arithmetic depend on where
// the server happens to run. Keep dates as plain 'YYYY-MM-DD' strings instead
// so they are parsed unambiguously (see utils/fine.js).
types.setTypeParser(1082, (value) => value);

// The spec requires all dates to be in IST, so every session (and CURRENT_DATE
// within it) must use that timezone rather than whatever the server defaults to.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  options: '-c timezone=Asia/Kolkata',
});

// node-postgres emits 'error' on the pool when an idle client's connection is
// dropped (e.g. a network blip or the DB restarting). Without a listener here,
// that becomes an uncaught exception and takes down the whole server.
pool.on('error', (err) => {
  console.error('Unexpected error on idle Postgres client:', err.message);
});

module.exports = pool;
