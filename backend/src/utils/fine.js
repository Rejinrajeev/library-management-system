const FINE_PER_DAY = 10;

/**
 * Whole calendar days late, and the fine owed.
 * dueDate/returnDate are Date objects or YYYY-MM-DD strings, compared as dates only.
 */
function calculateFine(dueDate, returnDate) {
  const due = toDateOnly(dueDate);
  const ret = toDateOnly(returnDate);

  if (ret <= due) {
    return { daysLate: 0, fine: 0 };
  }

  const msPerDay = 24 * 60 * 60 * 1000;
  const daysLate = Math.round((ret - due) / msPerDay);
  return { daysLate, fine: daysLate * FINE_PER_DAY };
}

function toDateOnly(value) {
  if (value instanceof Date) {
    return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
  }
  // Plain 'YYYY-MM-DD' string (as returned by pg for DATE columns, see db/pool.js).
  const [year, month, day] = String(value).split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

// Dates from Postgres DATE columns are timezone-agnostic calendar dates, but
// "now" is an instant that must be read as an IST calendar date to match
// CURRENT_DATE in the DB session (also pinned to Asia/Kolkata).
function todayIST() {
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return new Date(`${ymd}T00:00:00Z`);
}

module.exports = { calculateFine, todayIST, FINE_PER_DAY };
