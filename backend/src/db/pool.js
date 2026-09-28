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

module.exports = pool;
